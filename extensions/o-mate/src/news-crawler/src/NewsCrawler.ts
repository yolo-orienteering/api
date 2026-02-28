import puppeteer, { Browser, Page } from 'puppeteer'
import { Post, PostMedia } from '../../types/DirectusTypes'
import { ItemsService } from '@directus/api/dist/services/items'
import { TableName } from './api'
import { Item } from '@directus/types'
import { SolvNews } from './news-sites/SolvNews'
import { SrfNews } from './news-sites/SrfNews'
import { TamediaNews } from './news-sites/TamediaNews'
import { BlickNews } from './news-sites/BlickNews'
import { AargauerZeitungNews } from './news-sites/AargauerZeitungNews'
import { NewsSiteAdapterProps } from './news-sites/NewsSiteAdapter'

export interface NewsSite {
  path: string
  source: 'solv' | 'srf' | 'blick' | 'tamedia' | 'aargauerzeitung'
}

const NEWS_SITES: NewsSite[] = [
  {
    path: '/news/ol',
    source: 'solv',
  },
  {
    path: '/news/ol',
    source: 'solv',
  },
  {
    path: '/news/ski-ol',
    source: 'solv',
  },
  {
    path: '/news/bike-ol',
    source: 'solv',
  },
  {
    path: '/news/verband',
    source: 'solv',
  },
  {
    path: '/news/news-ausbildung',
    source: 'solv',
  },
  {
    path: '/sport/mehr-sport/orientierungslauf',
    source: 'srf',
  },
  {
    path: '/search?q=orientierungslauf',
    source: 'tamedia',
  },
  {
    path: '/search?pub=blick&q=orientierungslauf&page=0',
    source: 'blick',
  },
  {
    path: '/suche?q=orientierungslauf&filter=y1',
    source: 'aargauerzeitung',
  },
]

interface NewsCrawlerProps {
  createItemsService: <T extends Item>(tableName: TableName) => ItemsService<T>
}

export interface UrlList {
  newsSite: NewsSite
  url: string
  date?: Date
}

export default class NewsCrawler {
  private browser?: Browser
  private browserPage?: Page
  private postsService: ItemsService<Post>
  private postMediasService: ItemsService<PostMedia>

  constructor({ createItemsService }: NewsCrawlerProps) {
    this.postsService = createItemsService<Post>('Post')
    this.postMediasService = createItemsService<PostMedia>('PostMedia')
  }

  public async crawl(): Promise<void> {
    try {
      console.log('Start crawling news.')
      await this.setupBrowserPage()
      await this.iterateNewsSites()
      console.log('Finished crawling news.')
    } catch (error) {
      console.error(error)
    } finally {
      this.browser?.close()
    }
  }

  private async iterateNewsSites() {
    for (const newsSite of NEWS_SITES) {
      console.info(`-- ${newsSite.source} / ${newsSite.path}`)
      const newsSiteInstance = this.getNewsAdapterInstance(newsSite)
      await newsSiteInstance?.init()
    }
  }

  private getNewsAdapterInstance(newsSite: NewsSite) {
    if (!this.browserPage) {
      console.error('Browser Page is missing unexpectedly.')
      return
    }

    const newsConstructorProps: NewsSiteAdapterProps = {
      browserPage: this.browserPage,
      newsSite: newsSite,
      postsService: this.postsService,
      postMediasService: this.postMediasService,
    }

    switch (newsSite.source) {
      case 'solv':
        return new SolvNews(newsConstructorProps)
      case 'srf':
        return new SrfNews(newsConstructorProps)
      case 'tamedia':
        return new TamediaNews(newsConstructorProps)
      case 'blick':
        return new BlickNews(newsConstructorProps)
      case 'aargauerzeitung':
        return new AargauerZeitungNews(newsConstructorProps)
      default:
        throw new Error(
          `Implementation for news site ${newsSite.source} is missing`,
        )
    }
  }

  /**
   * TODO > Same functions (copied) from SolvInstructions > merge them using BUNDLES > https://directus.io/docs/guides/extensions/bundles
   * Helper functions
   */
  private async setupBrowserPage(): Promise<void> {
    this.browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox'],
    })
    this.browserPage = await this.browser.newPage()
    await this.browserPage.setViewport({ width: 1920, height: 1080 })
  }
}
