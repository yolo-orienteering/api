import { parseISO } from 'date-fns'
import * as cheerio from 'cheerio'
import { PostMedia } from '../../../types/DirectusTypes'
import { UrlList } from '../NewsCrawler'
import { NewsSiteAdapter } from './NewsSiteAdapter'

/**
 * Interface for the JSON response structure from Blick Search API
 */
interface BlickContent {
  title: string
  lead: string
  publishedDate: string
  link: {
    href: string
  }
  image?: {
    src: string
    alt?: string
  }
}

interface BlickSearchResponse {
  content: BlickContent[]
}

export class BlickNews extends NewsSiteAdapter {
  BASE_URL: string = 'https://www.blick.ch'
  SEARCH_API_URL: string = 'https://search.ws.blick.ch'
  // IMAGE_BASE_URL: string = 'https://img.blick.ch' // Not strictly used if we extract full URLs or standard relative handling

  async listNews(): Promise<void> {
    const { path } = this.newsSite
    const url = `${this.SEARCH_API_URL}${path}`

    try {
      // Use page.evaluate to fetch data using the browser context
      // This helps bypass potential bot detection and handles CORS if we were in browser (though here we are in Node + Puppeteer)
      const response = (await this.browserPage.evaluate(async (fetchUrl) => {
        const res = await fetch(fetchUrl)
        return res.json()
      }, url)) as BlickSearchResponse

      if (!response || !response.content || !Array.isArray(response.content)) {
        console.warn('Invalid response structure from Blick API', response)
        return
      }

      const links: UrlList[] = response.content.map((item) => ({
        newsSite: this.newsSite,
        // The API returns relative links like "/stichwort/..."
        url: `${this.BASE_URL}${item.link.href}`,
        date: parseISO(item.publishedDate),
      }))

      this.newsUrlList.push(...links)
    } catch (e) {
      console.error(`Failed to fetch blick news list: ${e}`)
      return
    }
  }

  async downloadANews(urlWithDate: UrlList): Promise<void> {
    const { url, date } = urlWithDate

    const content = await this.getContentFromWebsite(url)

    if (!content) {
      console.warn(`No content found for ${url}`)
      return
    }

    const $ = cheerio.load(content)

    // Check for keyword 'orientierungslauf' in content text to filter out unrelated articles
    // We target the main article content (usually <article> or <main>) to avoid header/footer matching
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
    // Blick uses .article__lead or similar classes
    let lead = $('.article__lead').first().text().trim()
    if (!lead) {
      lead = $('.lead, [class*="lead"]').first().text().trim()
    }
    if (!lead) {
        lead = $('meta[property="og:description"]').attr('content') || ''
    }

    // Extract Images
    const images: Partial<PostMedia>[] = []

    // 1. Check for main image in meta tags (often best quality/representative)
    const metaImage = $('meta[property="og:image"]').attr('content')
    if (metaImage) {
         images.push({
            imageUrl: metaImage,
            caption: title,
         })
    }

    // 2. Check article images in figures
    $('figure').each((_, el) => {
      const $img = $(el).find('img')
      const src = $img.attr('src')
      const caption = $(el).find('figcaption').text().trim() 

      if (src && !images.some((img) => img.imageUrl === src)) {
        let imageUrl = src
        
        // Handle relative URLs
        if (src.startsWith('/')) {
            imageUrl = `${this.BASE_URL}${src}` 
        } else if (src.startsWith('//')) {
             imageUrl = `https:${src}`
        }

        // Avoid adding duplicates (especially if meta image is also in body)
        if (!images.some((img) => img.imageUrl === imageUrl)) {
            images.push({
                imageUrl,
                caption: caption || title,
            })
        }
      }
    })

    this.newsListToSave.push({
      title,
      lead,
      sourceUrl: url,
      date_created: date ? date.toISOString() : new Date().toISOString(),
      type: 'news-post',
      status: 'published',
      medias: images as PostMedia[],
    })
  }
}
