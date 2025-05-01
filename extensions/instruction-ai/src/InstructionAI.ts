import OpenAI from 'openai'
import { CustomDirectusTypes, Race, RaceInstruction } from './types/DirectusTypes'
import { ItemsService } from '@directus/api/dist/services/items'

export type TableName = keyof CustomDirectusTypes

interface InstructionsAIProps {
  createItemsService: (tableName: TableName) => ItemsService
}

export default class InstructionAI {
  private openAIclient: OpenAI
  private instructionsService: ItemsService

  constructor ({createItemsService}: InstructionsAIProps) {
    this.openAIclient = new OpenAI()
    this.instructionsService = createItemsService('RaceInstruction')
  }

  public async run (): Promise<void> {
    // 1. upload file

  }

  private async getInstructions (): Promise<RaceInstruction[]> {
    return await this.instructionsService.readByQuery({
      offset: -1
    }) as RaceInstruction[]
  }
}