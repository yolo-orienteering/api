import { TableName } from '../../types/Utilities'

export interface CrawlerOptions {
  createItemsService: (tableName: TableName) => any
}

export default class Crawler {
  public createItemsService: (tableName: TableName) => any

  constructor({createItemsService}: CrawlerOptions) {
    this.createItemsService = createItemsService
  }
}