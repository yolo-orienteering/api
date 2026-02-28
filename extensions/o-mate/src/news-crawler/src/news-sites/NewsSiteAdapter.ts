import { Page } from 'puppeteer'
import { NewsSite, UrlList } from '../NewsCrawler'
import { Post } from '../../../types/DirectusTypes'

export abstract class NewsSiteAdapter {
  protected abstract BASE_URL: string
  private browserPage: Page

  constructor(browserPage: Page) {
    this.browserPage = browserPage
  }

  abstract listNews(newsSite: NewsSite, newsUrlList: UrlList[]): Promise<void>

  abstract downloadANews(
    urlWithDate: UrlList,
    newsListToSave: Partial<Post>[],
  ): Promise<void>

  protected async getContentFromWebsite(
    url: string,
  ): Promise<string | undefined> {
    if (!this.browserPage) {
      console.warn('Browser page is not available. Initialization missing?')
      return
    }
    try {
      await this.browserPage.goto(url, {
        waitUntil: 'networkidle2',
      })
      return this.browserPage.content()
    } catch (error) {
      return
    }
  }
}
