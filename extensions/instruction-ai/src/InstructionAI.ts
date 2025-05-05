import OpenAI from 'openai'
import { CustomDirectusTypes, RaceInstruction } from './types/DirectusTypes'
import { ItemsService } from '@directus/api/dist/services/items'
import fprint from 'fprint'
import { APIPromise } from 'openai/core'

export type TableName = keyof CustomDirectusTypes

interface InstructionsAIProps {
  createItemsService: (tableName: TableName) => ItemsService
  ai: OpenAI
}

/**
 * TODO & CONTINUE
 * Speichere die instruction links im neuen Model "RaceInstruction" und nicht mehr direkt in "Race"
 * Entferne instructionLink beim Model "Race"
 * Handle Links, welche nicht PDFs abrufen aber Webseiten > Die haben immer einen anderen Hash.
 * Füge weitere AI-Felder hinzu. Z.B. "Zusammenfassung, WC usw."
 * Speichere Infos zum Job.
 * Erstelle einen Flow.
 */

export default class InstructionAI {
  private ai: OpenAI
  private instructionsService: ItemsService
  private instructions: RaceInstruction[]
  private instructionsWithNewFiles: string[]

  constructor ({createItemsService, ai}: InstructionsAIProps) {
    this.ai = ai
    this.instructionsService = createItemsService('RaceInstruction')
    this.instructions = []
    this.instructionsWithNewFiles = []
  }

  public async run (): Promise<void> {
    try {
      await this.loadFutureInstructions()
      await this.uploadFilesToAI()
      await this.processInstructionsWithAI()
      console.log('Job done')
    } catch (error) {
      console.log(error)
    }
  }

  private async loadFutureInstructions (): Promise<void> {
    this.instructions = await this.instructionsService.readByQuery({
      filter: {
        _or: [
          {
            linkCrawled: {
              _empty: false
            }
          },
          {
            linkOverwritten: {
              _empty: false
            }
          }
        ],
        race: {
          date: {
            _gte: new Date().toISOString()
          }
        }
      },
      limit: -1
    }) as RaceInstruction[]
    console.log(`Found ${this.instructions?.length}.`)
  }

  private async uploadFilesToAI (): Promise<void> {
    if (!this.instructions.length) {
      console.warn('No instructions to be processed.')
      return
    }

    for (const instruction of this.instructions) {
      console.log(`Upload file to AI for instruction with id ${instruction.id}`)
      await this.uploadFileToAI(instruction)
    }
  }

  private async processInstructionsWithAI (): Promise<void> {
    if (!this.instructionsWithNewFiles.length) {
      console.warn('No instructions with new files.')
      return
    }

    const instructions = await this.instructionsService.readByQuery({
      filter: {
        id: {
          _in: this.instructionsWithNewFiles
        }
      }
    }) as RaceInstruction[]

    if (instructions.length !== this.instructionsWithNewFiles.length) {
      throw new Error(`Unexpected Error: Loaded instructions do not equal the expected amount.`)
    }

    const instructionsUpdate: Partial<RaceInstruction>[] = []

    for (const instruction of instructions) {
      console.log('Ask AI and waiting for response...')
      const [publicTransportAI, summary] = await Promise.all([
        this.askAI({
          instruction,
          aiInstructions: 'return only the name of the public transport station.',
          text: 'Wie lautet die ÖV-Haltestelle?'
        }),
        this.askAI({
          instruction,
          aiInstructions: 'return a short answer in bullet points. return format in plain text. you can use line breaks.',
          text: 'Fasse die Datei zusammen zu folgenden Punkten: Weg von der ÖV-Station zum Wettkampfzentrum (WKZ) und von dort zum Start? Wie lang ist der Gesamtweg und die Gesamtdauer? / Von wann bis wann kann man starten? / Kleiderdepot vorhanden? / Wo sind WC vorhanden?'
        })
      ])

      instructionsUpdate.push({
        id: instruction.id,
        publicTransportAI: publicTransportAI?.output_text,
        summaryAI: summary?.output_text,
      })
    }

    await this.instructionsService.upsertMany(instructionsUpdate)
  }

  private async askAI (
    {instruction, text, aiInstructions}:
    {instruction: RaceInstruction, text: string, aiInstructions: string}
  ): Promise<APIPromise<OpenAI.Responses.Response> | undefined> {  
    const fileId = instruction.fileIdAI
    if (!fileId) {
      console.warn(`No AI file id available for instruction with id ${instruction.id}`)
      return
    }

    return await this.ai.responses.create({
      model: 'gpt-4.1-nano',
      input: [
          {
            role: 'user',
            content: [
                {
                    type: 'input_file',
                    file_id: fileId
                },
                {
                    type: "input_text",
                    text
                }
            ]
          },
        ],
      instructions: aiInstructions,
      temperature: 0.2
    })
  }

  private async uploadFileToAI (instruction: RaceInstruction): Promise<void> {
    try {
      const filePath = instruction.linkOverwritten || instruction.linkCrawled
      if (!filePath) {
        console.warn(`No link to file found.`)
        return
      }

      // download file
      const res = await fetch(filePath)
      const arrayBuffer = await res.arrayBuffer()
      
      // compare hash and eventually skip the file upload
      const fileHash = await this.generateHashAndCompare(arrayBuffer, instruction)

      if (!fileHash) {
        return
      }
      
      // upload file to open ai
      const fileName = `${instruction.id}.pdf`
      const file = new File([arrayBuffer], fileName)
      const result = await this.ai.files.create({
        file: file,
        purpose: 'user_data'
      })

      const fileId = result.id
      if (!fileId) {
        console.error(`File upload failed for instruction with id ${instruction.id}`)
        return
      }

      // store file id and hash
      const updatedInstruction = await this.instructionsService.updateOne(instruction.id, {
        fileIdAI: fileId,
        fileHash
      })

      // add instruction to the list, which must be processed again
      this.instructionsWithNewFiles.push(updatedInstruction as string)
    } catch (error) {
      console.log(error)
      return
    }
  }

  private async generateHashAndCompare (arrayBuffer: ArrayBuffer, instruction: RaceInstruction): Promise<string | false> {
    const buffer = Buffer.from(arrayBuffer)
    const generatedHash = await fprint(buffer, 'sha256')
    const storedHash = instruction.fileHash

    if (!generatedHash) {
      console.warn(`Could not generate hash for instruction id ${instruction.id}`)
      return false
    }
    if (generatedHash === storedHash) {
      console.warn(`Instruction file with id ${instruction.id} already uploaded to OpenAI.`)
      return false
    }

    return generatedHash
  }
}