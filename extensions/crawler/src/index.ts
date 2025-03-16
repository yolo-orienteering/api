import { defineHook } from '@directus/extensions-sdk'	
import { Item } from '@directus/types'
import type { ItemsService } from '@directus/api/dist/services/items'
import Solv from './sources/Solv'
import { CustomDirectusTypes } from './types/DirectusTypes'

type TableName = keyof CustomDirectusTypes

export default defineHook(async ({ schedule }, {services, getSchema}) => {
	const schema = await getSchema()

	const createItemsService = function<T extends Item>(tableName: TableName): ItemsService<T> {
		return new services.ItemsService(tableName, {
			schema
		})
	}

	schedule('0 */15 * * * *', async () => {
		console.log('Crawling SOLV...')
		await new Solv({createItemsService: createItemsService}).crawl()
	})
})
