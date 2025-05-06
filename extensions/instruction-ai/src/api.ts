import { Item } from '@directus/types'
import { defineOperationApi } from '@directus/extensions-sdk'
import InstructionAI from './InstructionAI'
import { CustomDirectusTypes } from './types/DirectusTypes'
import type { ItemsService } from '@directus/api/dist/services/items'
import OpenAI from 'openai'

type Options = []
type TableName = keyof CustomDirectusTypes

export default defineOperationApi<Options>({
	id: 'o-mate-instruction-ai',
	handler: async (_options, {services, getSchema, env}) => {
		const schema = await getSchema()

		const createItemsService = function<T extends Item>(tableName: TableName): ItemsService<T> {
			return new services.ItemsService(tableName, {
				schema
			})
		}

		// preparing open ai
		const OPEN_AI_KEY = env.OPEN_AI_KEY

    if (!OPEN_AI_KEY || typeof OPEN_AI_KEY !== 'string') {
      console.log('Missing env variable OPEN_AI_KEY! Abort')
      return
    }
		const ai = new OpenAI({apiKey: OPEN_AI_KEY})

		await new InstructionAI({createItemsService, ai}).run()
	}
})
