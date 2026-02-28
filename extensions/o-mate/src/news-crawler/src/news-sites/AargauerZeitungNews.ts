import * as cheerio from 'cheerio'
import { PostMedia } from '../../../types/DirectusTypes'
import { UrlList } from '../NewsCrawler'
import { NewsSiteAdapter } from './NewsSiteAdapter'

export class AargauerZeitungNews extends NewsSiteAdapter {
  BASE_URL: string = 'https://www.aargauerzeitung.ch'

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

    // Select all links that contain 'ld.' which indicates an article
    $('a[href*="ld."]').each((_, el) => {
      const href = $(el).attr('href')

      if (href) {
        const fullUrl = href.startsWith('http')
          ? href
          : `${this.BASE_URL}${href}`

        // Try to extract date from the teaser if available
        // Structure in search: <span data-timestamp-span="...">DD.MM.YYYY</span>
        const dateText =
          $(el).find('span[data-timestamp-span]').text().trim() ||
          $(el)
            .closest('.teaser')
            .find('span[data-timestamp-span]')
            .text()
            .trim()

        // Avoid duplicates
        if (!links.some((l) => l.url === fullUrl)) {
          let date: Date | undefined
          if (dateText) {
            try {
              // parse format dd.MM.yyyy
              const parts = dateText.split('.')
              if (parts.length === 3) {
                date = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`)
              }
            } catch (e) {
              // ignore invalid date
            }
          }

          links.push({
            newsSite: this.newsSite,
            url: fullUrl,
            date,
          })
        }
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

    // We target the main article content to avoid header/footer matching
    // Common CH Media structure often uses 'article' tag
    const $article = $('article').first()
    const textToCheck = $article.length ? $article.text() : $('body').text()

    if (!textToCheck.toLowerCase().includes('orientierungslauf')) {
      console.log(
        `------ Skipping article ${url} as it does not contain keyword`,
      )
      return
    }

    // Extract Title
    let title = $('h1').first().text().trim()
    if (!title) {
      title = $('meta[property="og:title"]').attr('content') || ''
    }

    // Extract Lead
    let lead = $('.lead').first().text().trim()
    if (!lead) {
      // Fallback: try to find the first paragraph in the article body
      lead = $article.find('p').first().text().trim()
    }

    // Extract Date if not already found from list
    if (!urlWithDate.date) {
      // Try meta tag
      const publishedTime = $('meta[property="article:published_time"]').attr(
        'content',
      )
      if (publishedTime) {
        date = new Date(publishedTime)
      } else {
        // Try searching text for date pattern
        const dateMatch = $article.text().match(/(\d{2}\.\d{2}\.\d{4})/)
        if (dateMatch?.[1]) {
          const parts = dateMatch[1].split('.')
          date = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`)
        }
      }
    }

    // Extract Images
    const images: Partial<PostMedia>[] = []

    // 1. Meta image
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
