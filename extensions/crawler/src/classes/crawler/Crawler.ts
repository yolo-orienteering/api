import { ItemsService } from '@directus/api/dist/services/items'
import { TableName } from '../../types/Utilities'

export interface CrawlerOptions {
  createItemsService: (tableName: TableName) => ItemsService
  dataSourceName: string
}

export default class Crawler {
  public createItemsService: (tableName: TableName) => ItemsService
  // unique name of the data source. E.g. "solv"
  public dataSourceName: string

  constructor({createItemsService, dataSourceName}: CrawlerOptions) {
    this.createItemsService = createItemsService
    this.dataSourceName = dataSourceName
  }
}