import puppeteer, { Browser, Page } from 'puppeteer'
import * as cheerio from 'cheerio'

export default class NewsCrawler {
  private newsList: string[]
  private browser?: Browser
  private browserPage?: Page

  constructor() {
    this.newsList = []
  }

  public async crawl(): Promise<void> {
    console.log('Start crawling News from SOLV.')
    await this.setupBrowserPage()
    await this.listNews()
    await this.downloadAllNews()
    console.log('Finished crawling news from SOLV.')
  }

  private async listNews() {
    const baseUrl = 'https://www.swiss-orienteering.ch'
    const url = `${baseUrl}/news/ol.html`
    const content = await this.getContentFromWebsite(url)
    if (!content) {
      console.warn('Website content was empty for url', url)
      return
    }
    // get all the links from the website
    const $ = cheerio.load(content)
    const links = $('a[href*="/news/ol/"]')
      .map((_, el) => $(el).attr("href"))
      .get()

    this.newsList = links.map(link => `${baseUrl}${link}`)
  }

  private async downloadAllNews() {
    for (const news of this.newsList) {
      await this.downloadANews(news)
    }
  }

  private async downloadANews(newsUrl: string) {
    console.log(`Reading content of ${newsUrl}`)
    const content = await this.getContentFromWebsite(newsUrl)
    if (!content) {
      console.warn(`No content found for ${newsUrl}`)
      return
    }

    const $ = cheerio.load(content)
    const title = $('.page-header h1').text().trim()
    const lead = $('.com-content-article__body strong').first().text().trim()

    // TODO: continue here
    console.log(title)
    console.log(lead)
  }

  /**
   * TODO > Same functions (copied) from SolvInstructions > merge them
   * Helper functions
   */
  private async setupBrowserPage(): Promise<void> {
    this.browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] })
    this.browserPage = await this.browser.newPage()
    await this.browserPage.setViewport({ width: 1920, height: 1080 })
  }

  private async getContentFromWebsite(url: string): Promise<string | undefined> {
    if (!this.browserPage) {
      console.warn('Browser page is not available. Initialization missing?')
      return
    }
    try {
      await this.browserPage.goto(url, {
        waitUntil: 'networkidle2'
      })
      return this.browserPage.content()
    } catch (error) {
      return
    }
  }
}