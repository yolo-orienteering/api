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

  // Only keep articles that are actually about orienteering: the title or lead
  // must mention the sport or an athlete. `orientierungsl[aä]uf` matches both
  // "Orientierungslauf" and the runner forms "Orientierungsläufer(in)" — many
  // articles only ever use the latter and never write "Orientierungslauf". We
  // also match the standalone abbreviation "OL" (incl. prefixes like
  // "OL-Weltcup"). Matching only the title/lead — not the full article body —
  // avoids capturing pieces that merely mention OL in a short aside deep in the
  // text. No `g` flag, so repeated `.test()` is stateless.
  private static readonly OL_KEYWORD_REGEX = /orientierungsl[aä]uf|\bol\b/i

  // `Post.title`, `PostMedia.caption`, `PostMedia.imageUrl` and
  // `PostMedia.youtubeUrl` are all varchar(255) columns. `Post.lead` is `text`
  // (unbounded).
  private static readonly MAX_VARCHAR = 255

  /**
   * Whether an article is about orienteering, judged from its title and lead
   * only. General-media adapters use this to discard unrelated articles that
   * broad searches or section pages surface.
   */
  protected isOrienteeringNews(title: string, lead: string): boolean {
    return NewsSiteAdapter.OL_KEYWORD_REGEX.test(`${title} ${lead}`)
  }

  /**
   * Return the first candidate string that parses to a valid `Date`, or
   * `undefined` if none do. Adapters feed this the various date sources a page
   * exposes (meta tags, `<time datetime>`, …) in priority order. The validity
   * guard is important: a malformed value would otherwise produce an Invalid
   * Date that throws when later serialised with `.toISOString()`.
   */
  protected parseFirstValidDate(
    candidates: (string | null | undefined)[],
  ): Date | undefined {
    for (const candidate of candidates) {
      if (!candidate) {
        continue
      }
      const parsed = new Date(candidate)
      if (!isNaN(parsed.getTime())) {
        return parsed
      }
    }
    return undefined
  }

  protected postsService: ItemsService<Post>
  protected postMediasService: ItemsService<PostMedia>

  protected browserPage: Page
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
      // Isolate failures: one unparseable article must not abort the rest.
      try {
        await this.downloadANews(news)
      } catch (error) {
        console.error(`Failed to download news ${news.url}:`, error)
      }
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
          // Preserve the admin-controlled publication status: if an existing
          // post was unpublished (draft/archived) in the Directus admin, keep
          // it that way instead of letting the crawler re-publish it.
          status: existingPost.status,
        }
      })
    }

    // Column-length safety net. A single value that overflows a varchar(255)
    // column makes the whole `upsertMany` fail with VALUE_TOO_LONG, which would
    // otherwise drop every post crawled for this source (some CDN image URLs
    // legitimately exceed 255 characters).
    this.newsListToSave = this.newsListToSave.map((post) =>
      this.enforceColumnLimits(post),
    )

    // save existing and new posts
    await this.postsService.upsertMany(this.newsListToSave)

    // delete connected post media to avoid garbage media
    await this.postMediasService.deleteMany(postMediasToDelete)
  }

  /**
   * Truncate/trim a post's values so they fit their varchar(255) columns.
   * Display text (title, caption) is safe to truncate; URLs are not, so an
   * over-long URL has its query string dropped and, failing that, is removed
   * entirely (a missing image beats a dead link or a failed save). Media left
   * with no usable source is discarded.
   */
  private enforceColumnLimits(post: Partial<Post>): Partial<Post> {
    const sanitized: Partial<Post> = { ...post }

    if (
      typeof sanitized.title === 'string' &&
      sanitized.title.length > NewsSiteAdapter.MAX_VARCHAR
    ) {
      sanitized.title = sanitized.title.slice(0, NewsSiteAdapter.MAX_VARCHAR)
    }

    if (Array.isArray(sanitized.medias)) {
      sanitized.medias = (sanitized.medias as PostMedia[])
        .map((media) => this.fitMedia(media))
        .filter((media) => media.imageUrl || media.youtubeUrl) as PostMedia[]
    }

    return sanitized
  }

  private fitMedia(media: PostMedia): PostMedia {
    const result: PostMedia = { ...media }
    if (
      typeof result.caption === 'string' &&
      result.caption.length > NewsSiteAdapter.MAX_VARCHAR
    ) {
      result.caption = result.caption.slice(0, NewsSiteAdapter.MAX_VARCHAR)
    }
    if (
      typeof result.imageUrl === 'string' &&
      result.imageUrl.length > NewsSiteAdapter.MAX_VARCHAR
    ) {
      result.imageUrl = this.fitLongUrl(result.imageUrl)
    }
    if (
      typeof result.youtubeUrl === 'string' &&
      result.youtubeUrl.length > NewsSiteAdapter.MAX_VARCHAR
    ) {
      result.youtubeUrl = this.fitLongUrl(result.youtubeUrl)
    }
    return result
  }

  private fitLongUrl(url: string): string | null {
    const withoutQuery = url.split('?')[0]
    if (withoutQuery && withoutQuery.length <= NewsSiteAdapter.MAX_VARCHAR) {
      return withoutQuery
    }
    return null
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
