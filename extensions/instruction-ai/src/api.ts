import { Item } from '@directus/types'
import { defineOperationApi } from '@directus/extensions-sdk'
import InstructionAI from './InstructionAI'
import { CustomDirectusTypes } from './types/DirectusTypes'
import type { ItemsService } from '@directus/api/dist/services/items'

type Options = []
type TableName = keyof CustomDirectusTypes

export default defineOperationApi<Options>({
	id: 'o-mate-instruction-ai',
	handler: async (_options, {services, getSchema}) => {
		console.log('Start processing instructions with AI.')

		const schema = await getSchema()

		const createItemsService = function<T extends Item>(tableName: TableName): ItemsService<T> {
			return new services.ItemsService(tableName, {
				schema
			})
		}

		new InstructionAI({createItemsService})
			.run()
	}
})
