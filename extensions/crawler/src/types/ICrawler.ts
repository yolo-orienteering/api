export default interface ICrawler {
  // unique name of the data source. E.g. "solv"
  dataSourceName: string
  // entry point for a crawler to run
  crawl: () => void
}
