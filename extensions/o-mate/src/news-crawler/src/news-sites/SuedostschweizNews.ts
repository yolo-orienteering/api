import * as cheerio from 'cheerio'
import { PostMedia } from '../../../types/DirectusTypes'
import { UrlList } from '../NewsCrawler'
import { NewsSiteAdapter } from './NewsSiteAdapter'

// suedostschweiz.ch is server-rendered and the configured path is a full-text
// search for "orientierungslauf". A broad search surfaces plenty of tangential
// hits (an article that merely mentions OL in passing), so we keyword-filter on
// the title and lead — mirroring the other search-based adapters (NZZ, AZ).
export class SuedostschweizNews extends NewsSiteAdapter {
  BASE_URL: string = 'https://www.suedostschweiz.ch'

  // Article URLs look like `/<section>/<slug>-<numeric-id>`. Section and
  // navigation links (e.g. `/regionalsport`, `/thema/kultur`) have no trailing
  // numeric id and are excluded by this pattern.
  private readonly ARTICLE_PATH_REGEX = /^\/[a-z0-9-]+\/[^/]+-\d{5,}$/i

  async listNews(): Promise<void> {
    const { path } = this.newsSite
    const siteUrl = `${this.BASE_URL}${path}`

    const content = await this.getContentFromWebsite(siteUrl)

    if (!content) {
      console.warn('Website content was empty for url', siteUrl)
      return
    }

    const $ = cheerio.load(content)
    const links: UrlList[] = []

    $('a[href]').each((_, el) => {
      const href = $(el).attr('href')
      if (!href) {
        return
      }

      // Reduce absolute links to their path and drop any query string.
      const urlPath = (
        href.startsWith('http') ? href.replace(/^https?:\/\/[^/]+/, '') : href
      ).split('?')[0]

      if (!urlPath || !this.ARTICLE_PATH_REGEX.test(urlPath)) {
        return
      }

      const fullUrl = `${this.BASE_URL}${urlPath}`

      // Avoid duplicates
      if (!links.some((l) => l.url === fullUrl)) {
        links.push({
          newsSite: this.newsSite,
          url: fullUrl,
        })
      }
    })

    this.newsUrlList.push(...links)
  }

  async downloadANews(urlWithDate: UrlList): Promise<void> {
    const { url } = urlWithDate
    let date = urlWithDate.date || new Date()

    const content = await this.getContentFromWebsite(url)

    if (!content) {
      console.warn(`No content found for ${url}`)
      return
    }

    const $ = cheerio.load(content)
    const $article = $('article').first()

    // Extract Title
    let title = $('h1').first().text().trim()
    if (!title) {
      title = $('meta[property="og:title"]').attr('content') || ''
    }

    // Extract Lead — og:description mirrors the article lead when present, but
    // it is frequently empty on older regional articles. In that case fall back
    // to the first substantial article paragraph, skipping the author byline
    // (rendered as a leading "von …" paragraph) and short captions.
    let lead = $('meta[property="og:description"]').attr('content')?.trim() || ''
    if (!lead) {
      $article.find('p').each((_, el) => {
        if (lead) {
          return
        }
        const text = $(el).text().trim()
        if (text.length >= 40 && !/^von\s/i.test(text)) {
          lead = text
        }
      })
    }

    // Only keep the article if the orienteering keyword appears in the title or
    // lead — not just somewhere deep in the body.
    if (!this.isOrienteeringNews(title, lead)) {
      console.log(
        `------ Skipping article ${url} as title/lead does not contain OL keyword`,
      )
      return
    }

    // Extract Date — suedostschweiz exposes a machine-readable published time.
    const structuredDate = this.parseFirstValidDate([
      $('meta[property="article:published_time"]').attr('content'),
      $('meta[name="date"]').attr('content'),
      $('time[datetime]').first().attr('datetime'),
    ])
    if (structuredDate) {
      date = structuredDate
    }

    // Extract Images
    const images: Partial<PostMedia>[] = []
    const metaImage = $('meta[property="og:image"]').attr('content')
    if (metaImage) {
      images.push({
        imageUrl: metaImage,
        caption: title,
      })
    }

    this.newsListToSave.push({
      title,
      lead,
      sourceUrl: url,
      date_created: date.toISOString(),
      type: 'news-post',
      status: 'published',
      medias: images as PostMedia[],
    })
  }
}
