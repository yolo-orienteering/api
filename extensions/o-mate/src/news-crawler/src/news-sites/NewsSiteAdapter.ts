import { Page } from 'puppeteer'
import { NewsSite, UrlList } from '../NewsCrawler'
import { Post, PostMedia } from '../../../types/DirectusTypes'
import { ItemsService } from '@directus/api/dist/services/items'

export interface NewsSiteAdapterProps {
  browserPage: Page
  newsSite: NewsSite
  postsService: ItemsService<Post>
  postMediasService: ItemsService<PostMedia>
}

export abstract class NewsSiteAdapter {
  protected abstract BASE_URL: string

  protected postsService: ItemsService<Post>
  protected postMediasService: ItemsService<PostMedia>

  private browserPage: Page
  protected newsSite: NewsSite
  protected newsUrlList: UrlList[]
  protected newsListToSave: Partial<Post>[]

  constructor({
    browserPage,
    newsSite,
    postsService,
    postMediasService,
  }: NewsSiteAdapterProps) {
    this.browserPage = browserPage
    this.newsSite = newsSite
    this.postsService = postsService
    this.postMediasService = postMediasService
    this.newsUrlList = []
    this.newsListToSave = []
  }

  public async init() {
    await this.listNews()
    await this.downloadAllNews()
    await this.saveAllNews()
  }

  protected abstract listNews(): Promise<void>

  private async downloadAllNews() {
    console.log(`---- download news`)
    for (const news of this.newsUrlList) {
      await this.downloadANews(news)
    }
  }

  protected abstract downloadANews(urlWithDate: UrlList): Promise<void>

  private async saveAllNews(): Promise<void> {
    console.log(`---- save crawled news.`)
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
