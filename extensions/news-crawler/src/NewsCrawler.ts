import puppeteer, { Browser, Page } from 'puppeteer'
import * as cheerio from 'cheerio'
import { Post, PostMedia } from './types/DirectusTypes'
import { ItemsService } from '@directus/api/dist/services/items'
import { TableName } from './api'
import { Item } from '@directus/types'

const BASE_URL = 'https://www.swiss-orienteering.ch'

const NEWS_SITES: string[] = [
  '/news/ol',
  '/news/ski-ol',
  '/news/bike-ol',
  '/news/verband',
  '/news/news-ausbildung'
]

interface NewsCrawlerProps {
  createItemsService: <T extends Item>(tableName: TableName) => ItemsService<T>
}

export default class NewsCrawler {
  private newsUrlList: string[]
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
    console.log('Start crawling News from SOLV.')
    await this.setupBrowserPage()
    await this.iterateNewsSites()
    await this.downloadAllNews()
    await this.saveAllNews()
    console.log('Finished crawling news from SOLV.')
  }

  private async iterateNewsSites() {
    for (const newsSite of NEWS_SITES) {
      const siteUrl = `${BASE_URL}${newsSite}.html`
      await this.listNews(siteUrl, newsSite)
    }
  }

  private async listNews(siteUrl: string, path: string) {
    const content = await this.getContentFromWebsite(siteUrl)
    if (!content) {
      console.warn('Website content was empty for url', siteUrl)
      return
    }
    // get all the links from the website
    const hrefFilter = `a[href*="${path}/"]`
    console.log(hrefFilter)
    const $ = cheerio.load(content)
    const links = $(hrefFilter)
      .map((_, el) => $(el).attr("href"))
      .get()

    console.log(links)

    this.newsUrlList = [...this.newsUrlList, ...links.map(link => `${BASE_URL}${link}`)]
  }

  private async downloadAllNews() {
    console.log('download all news', this.newsUrlList)
    for (const news of this.newsUrlList) {
      await this.downloadANews(news)
    }
  }

  private async downloadANews(newsUrl: string) {
    console.log(`Reading content from ${newsUrl}`)
    const content = await this.getContentFromWebsite(newsUrl)
    if (!content) {
      console.warn(`No content found for ${newsUrl}`)
      return
    }

    const $ = cheerio.load(content)
    const title = $('.page-header h1').text().trim()
    const lead = $('.com-content-article__body strong').first().text().trim()

    const images: Partial<PostMedia>[] = []
    $(".imagebox").each(function () {
      const imageUrl = $(this).find("img").attr("src") || null
      const caption = $(this).find(".text").text().trim()

      images.push({ imageUrl: `https://www.swiss-orienteering.ch${imageUrl}`, caption })
    })

    this.newsListToSave.push({
      title,
      lead,
      sourceUrl: newsUrl,
      type: 'news-post',
      status: 'published',
      medias: images as PostMedia[]
    })
  }

  private async saveAllNews(): Promise<void> {
    console.log('Upsert crawled news.')
    const newsUrls = this.newsListToSave.map(news => news.sourceUrl).filter(news => news !== null && news !== undefined)
    // get existing posts with urls
    const existingPosts = await this.postsService.readByQuery({
      filter: {
        sourceUrl: {
          _in: newsUrls || []
        }
      },
      fields: ['*', 'medias.id']
    }) as Post[]

    // delete futur unrelated post medias
    let postMediasToDelete: string[] = []

    // merge existing news with crawled ones
    if (existingPosts.length) {
      this.newsListToSave = this.newsListToSave.map(aNewsToSave => {
        const existingPost = existingPosts.find(tmpPost => tmpPost.sourceUrl === aNewsToSave.sourceUrl)
        if (!existingPost) {
          return aNewsToSave
        }

        // delete futur unrelated post medias
        postMediasToDelete = [...postMediasToDelete, ...(existingPost?.medias.map(media => (media as PostMedia).id) || [])]

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

  /**
   * TODO > Same functions (copied) from SolvInstructions > merge them using BUNDLES > https://directus.io/docs/guides/extensions/bundles
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