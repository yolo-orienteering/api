import puppeteer, { Browser, Page } from 'puppeteer'
import { Post, PostMedia } from '../../types/DirectusTypes'
import { ItemsService } from '@directus/api/dist/services/items'
import { TableName } from './api'
import { Item } from '@directus/types'
import { SolvNews } from './news-sites/SolvNews'
import { SrfNews } from './news-sites/SrfNews'

export interface NewsSite {
  path: string
  source: 'solv' | 'srf' | 'blick' | 'tamedia'
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
]

interface NewsCrawlerProps {
  createItemsService: <T extends Item>(tableName: TableName) => ItemsService<T>
}

export interface UrlList {
  newsSite: NewsSite
  url: string
  date: Date
}

export default class NewsCrawler {
  private newsUrlList: UrlList[]
  private newsListToSave: Partial<Post>[]
  private browser?: Browser
  private browserPage?: Page
  private postsService: ItemsService
  private postMediasService: ItemsService

  constructor({ createItemsService }: NewsCrawlerProps) {
    this.newsUrlList = []
    this.newsListToSave = []
    this.postsService = createItemsService<Post>('Post')
    this.postMediasService = createItemsService<PostMedia>('PostMedia')
  }

  public async crawl(): Promise<void> {
    try {
      console.log('Start crawling news.')
      await this.setupBrowserPage()
      await this.iterateNewsSites()
      await this.downloadAllNews()
      await this.saveAllNews()
      console.log('Finished crawling news.')
    } catch (error) {
      console.error(error)
    } finally {
      this.browser?.close()
    }
  }

  private async iterateNewsSites() {
    for (const newsSite of NEWS_SITES) {
      const newsSiteInstance = this.getNewsAdapterInstance(newsSite)
      await newsSiteInstance?.listNews(newsSite, this.newsUrlList)
    }
  }

  private async downloadAllNews() {
    console.log('download all news...', this.newsUrlList)
    for (const news of this.newsUrlList) {
      const newsSiteInstance = this.getNewsAdapterInstance(news.newsSite)

      await newsSiteInstance?.downloadANews(news, this.newsListToSave)
    }
  }

  private async saveAllNews(): Promise<void> {
    console.log('Upsert crawled news.')
    const newsUrls = this.newsListToSave
      .map((news) => news.sourceUrl)
      .filter((news) => news !== null && news !== undefined)
    // get existing posts with urls
    const existingPosts = (await this.postsService.readByQuery({
      filter: {
        sourceUrl: {
          _in: newsUrls || [],
        },
      },
      fields: ['*', 'medias.id'],
    })) as Post[]

    // delete futur unrelated post medias
    let postMediasToDelete: string[] = []

    // merge existing news with crawled ones
    if (existingPosts.length) {
      this.newsListToSave = this.newsListToSave.map((aNewsToSave) => {
        const existingPost = existingPosts.find(
          (tmpPost) => tmpPost.sourceUrl === aNewsToSave.sourceUrl,
        )
        if (!existingPost) {
          return aNewsToSave
        }

        // delete futur unrelated post medias
        postMediasToDelete = [
          ...postMediasToDelete,
          ...(existingPost?.medias.map((media) => (media as PostMedia).id) ||
            []),
        ]

        return {
          ...existingPost,
          ...aNewsToSave,
        }
      })
    }

    // save existing and new posts
    await this.postsService.upsertMany(this.newsListToSave)

    // delete connected post media to avoid garbage media
    await this.postMediasService.deleteMany(postMediasToDelete)
  }

  private getNewsAdapterInstance(newsSite: NewsSite) {
    if (!this.browserPage) {
      console.error('Browser Page is missing unexpectedly.')
      return
    }
    switch (newsSite.source) {
      case 'solv':
        return new SolvNews(this.browserPage)
      case 'srf':
        return new SrfNews(this.browserPage)
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
