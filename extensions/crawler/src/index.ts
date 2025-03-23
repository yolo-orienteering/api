import { defineHook } from '@directus/extensions-sdk'	
import { Item } from '@directus/types'
import type { ItemsService } from '@directus/api/dist/services/items'
import { CustomDirectusTypes } from './types/DirectusTypes'
import Solv from './sources/solv/Solv'

type TableName = keyof CustomDirectusTypes

export default defineHook(async ({ schedule }, {services, getSchema, env}) => {
	const CRAWLER_SCHEDULE = env.CRAWLER_SCHEDULE

	if (!CRAWLER_SCHEDULE || typeof CRAWLER_SCHEDULE !== 'string') {
		console.log('Missing env variable CRAWLER_SCHEDULE!')
		return
	}

	const schema = await getSchema()

	const createItemsService = function<T extends Item>(tableName: TableName): ItemsService<T> {
		return new services.ItemsService(tableName, {
			schema
		})
	}

	schedule(CRAWLER_SCHEDULE, async () => {
		console.log('Starting to crawl SOLV...')
		await new Solv({
			createItemsService,
			dataSourceName: 'solv'
		}).crawl()
	})
})
