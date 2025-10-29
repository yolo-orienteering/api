import { Item } from '@directus/types'
import { defineOperationApi } from '@directus/extensions-sdk'
import NewsCrawler from './NewsCrawler'
import { Schema } from './types/DirectusTypes'

type Options = []
export type TableName = keyof Schema

export default defineOperationApi<Options>({
	id: 'o-mate-news-crawler',
	handler: async (_options, { services, getSchema }) => {
		const schema = await getSchema()
		const { ItemsService } = services

		const createItemsService = function <T extends Item>(tableName: TableName): InstanceType<typeof ItemsService<T>> {
			return new services.ItemsService(tableName, {
				schema
			})
		}

		await new NewsCrawler({ createItemsService }).crawl()
	},
})
