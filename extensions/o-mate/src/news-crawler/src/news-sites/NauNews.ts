import * as cheerio from 'cheerio'
import { PostMedia } from '../../../types/DirectusTypes'
import { UrlList } from '../NewsCrawler'
import { NewsSiteAdapter } from './NewsSiteAdapter'

// Nau.ch is server-rendered and the configured path is Nau's dedicated
// orienteering section (`/sport/orientierungslauf`). Because the section is
// already an editorially curated OL topic, we do NOT keyword-filter the
// articles: their titles frequently omit the words "OL"/"Orientierungslauf"
// (e.g. an athlete-retirement headline), yet they are all about the sport.
export class NauNews extends NewsSiteAdapter {
  BASE_URL: string = 'https://www.nau.ch'

  // Article URLs look like `/sport/<category>/<slug>-<numeric-id>`. Section and
  // navigation links (e.g. `/sport/orientierungslauf`, `/sport/matchcenter`)
  // have no trailing numeric id and are excluded by this pattern.
  private readonly ARTICLE_PATH_REGEX = /^\/[a-z-]+\/[a-z-]+\/[^/]+-\d{6,}$/i

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

      // Reduce absolute links to their path so the pattern test is uniform.
      const urlPath = href.startsWith('http')
        ? href.replace(/^https?:\/\/[^/]+/, '')
        : href

      if (!this.ARTICLE_PATH_REGEX.test(urlPath)) {
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

    // Extract Title — the visible <h1> is clean; fall back to og:title (which
    // carries a " | Nau.ch" suffix that we strip).
    let title = $('h1').first().text().trim()
    if (!title) {
      title = ($('meta[property="og:title"]').attr('content') || '')
        .replace(/\s*\|\s*Nau\.ch\s*$/i, '')
        .trim()
    }

    // Extract Lead — og:description reliably mirrors the article lead.
    let lead = $('meta[property="og:description"]').attr('content')?.trim() || ''
    if (!lead) {
      lead = $article.find('p').first().text().trim()
    }

    // Extract Date — Nau exposes a machine-readable published time.
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
