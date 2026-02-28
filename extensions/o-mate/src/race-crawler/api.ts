import { Item } from '@directus/types'
import { defineOperationApi } from '@directus/extensions-sdk'
import { Schema } from '../types/DirectusTypes'
import type { ItemsService } from '@directus/api/dist/services/items'
import Solv from './sources/solv/Solv'
import { SolvDepartures } from './sources/solv/SolvDepartures'
import { SolvInstructions } from './sources/solv/SolvInstructions'

type Options = {
  text: string
}

type TableName = keyof Schema

export default defineOperationApi<Options>({
  id: 'race-crawler',
  handler: async ({}, { services, getSchema }) => {
    const schema = await getSchema()

    const createItemsService = function <T extends Item>(
      tableName: TableName,
    ): ItemsService<T> {
      return new services.ItemsService(tableName, {
        schema,
      })
    }

    // crawling for the solv events
    await new Solv({
      createItemsService,
      dataSourceName: 'solv',
    }).crawl()

    // crawling for departure times
    await new SolvDepartures({
      createItemsService,
      dataSourceName: 'solv',
    }).crawl()

    // crawling for race instructions
    await new SolvInstructions({
      createItemsService,
      dataSourceName: 'solv',
    }).crawl()
  },
})
