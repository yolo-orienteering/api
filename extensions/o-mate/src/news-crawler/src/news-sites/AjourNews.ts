import * as cheerio from 'cheerio'
import { PostMedia } from '../../../types/DirectusTypes'
import { UrlList } from '../NewsCrawler'
import { NewsSiteAdapter } from './NewsSiteAdapter'

// ajour.ch is an Angular single-page app; the crawler's Puppeteer page renders
// the client-side content (including the Open Graph meta tags) before we read
// it. The configured path is the editorially curated "Orientierungslauf" tag,
// so — like the Nau section — we do NOT keyword-filter: the tag itself
// guarantees the topic and the article titles frequently omit the word "OL".
export class AjourNews extends NewsSiteAdapter {
  BASE_URL: string = 'https://ajour.ch'

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

    // Scope to the story-feed entries so we skip the cookie-consent box and
    // footer, which also link to `/de/story/...` pages (imprint, privacy, …).
    $('app-story-feed-entry a[href*="/de/story/"]').each((_, el) => {
      const href = $(el).attr('href')
      if (!href) {
        return
      }

      const cleanHref = href.split('?')[0] ?? href
      const fullUrl = cleanHref.startsWith('http')
        ? cleanHref
        : `${this.BASE_URL}${cleanHref}`

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

    // Extract Title
    let title = $('h1').first().text().trim()
    if (!title) {
      title = $('meta[property="og:title"]').attr('content') || ''
    }

    // Extract Lead
    let lead = $('.lead').first().text().trim()
    if (!lead) {
      lead = $('meta[property="og:description"]').attr('content')?.trim() || ''
    }

    // Extract Date — ajour renders it as "Publiziert: DD.MM.YYYY, HH:mm Uhr".
    if (!urlWithDate.date) {
      const dateText =
        $('.publishedContainer').first().text().trim() ||
        $('.updatedDateTime').first().text().trim() ||
        $('body').text()
      const dateMatch = dateText.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/)
      if (dateMatch) {
        const [, day, month, year] = dateMatch
        date = new Date(`${year}-${month}-${day}`)
      }
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
