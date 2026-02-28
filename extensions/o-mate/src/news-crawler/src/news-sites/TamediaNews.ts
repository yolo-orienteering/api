import { parse } from 'date-fns'
import * as cheerio from 'cheerio'
import { PostMedia } from '../../../types/DirectusTypes'
import { UrlList } from '../NewsCrawler'
import { NewsSiteAdapter } from './NewsSiteAdapter'

export class TamediaNews extends NewsSiteAdapter {
  BASE_URL: string = 'https://www.tagesanzeiger.ch'

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

    // We will look for links that look like articles: /slug-digits
    $('[class*="TeaserList"] article[class*="teaser"] a').each((_, el) => {
      const href = $(el).attr('href')
      // Filtering for article links (usually end with numbers)
      if (href && /\d+$/.test(href) && !href.includes('/search?')) {
        const fullUrl = href.startsWith('http')
          ? href
          : `${this.BASE_URL}${href}`

        // Avoid duplicates
        if (!links.some((l) => l.url === fullUrl)) {
          links.push({
            newsSite: this.newsSite,
            url: fullUrl,
          })
        }
      }
    })

    this.newsUrlList.push(...links)
  }

  async downloadANews(urlWithDate: UrlList): Promise<void> {
    const { url } = urlWithDate
    // default date from listNews
    let date = new Date()

    const content = await this.getContentFromWebsite(url)

    if (!content) {
      console.warn(`No content found for ${url}`)
      return
    }

    const $ = cheerio.load(content)
    // Scope to article container with specific class to avoid unrelated content
    const $article = $('article[class*="ArticleContainer"]')

    if (!$article.text().toLowerCase().includes('orientierungslauf')) {
      console.log(
        `------ Skipping article ${url} as it does not contain keyword`,
      )
      return
    }

    // Extract Title
    // Usually in h1 or specific class
    const title = $article.find('h1').first().text().trim()

    // Extract Lead
    // Usually in a lead class/element
    let lead = $article.find('.lead').first().text().trim()
    if (!lead) {
      lead = $article.find('p').first().text().trim()
    }

    // Extract Date if we didn't get a good one
    // Look for "Publiziert: DD.MM.YYYY" or "Aktualisiert: DD.MM.YYYY" pattern
    const dateText = $article
      .text()
      .match(/(?:Publiziert|Aktualisiert):\s*(\d{2}\.\d{2}\.\d{4})/)
    if (dateText?.[1]) {
      date = parse(dateText[1], 'dd.MM.yyyy', new Date())
    }
    const images: Partial<PostMedia>[] = []

    // Get images from article body
    $article.find('figure img').each((_, el) => {
      const src = $(el).attr('src')
      const caption = $(el).closest('figure').find('figcaption').text().trim()

      if (
        src &&
        src.startsWith('http') &&
        !images.some((img) => img.imageUrl === src)
      ) {
        images.push({
          imageUrl: src,
          caption: caption || title,
        })
      }
    })

    this.newsListToSave.push({
      title, // If title is empty, validation might fail, but for now we trust the selector
      lead,
      sourceUrl: url,
      date_created: date.toISOString(),
      type: 'news-post',
      status: 'published',
      medias: images as PostMedia[],
    })
  }
}
