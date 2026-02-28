import { parse } from 'date-fns'
import { UrlList } from '../NewsCrawler'
import { NewsSiteAdapter } from './NewsSiteAdapter'
import * as cheerio from 'cheerio'
import { PostMedia } from '../../../types/DirectusTypes'

export class SolvNews extends NewsSiteAdapter {
  BASE_URL: string = 'https://www.swiss-orienteering.ch'

  public async listNews(): Promise<void> {
    const { path } = this.newsSite

    const siteUrl = `${this.BASE_URL}${path}.html`

    const content = await this.getContentFromWebsite(siteUrl)
    if (!content) {
      console.warn('Website content was empty for url', siteUrl)
      return
    }
    // get all the links from the website
    const hrefFilter = `a[href*="${path}/"]`
    const $ = cheerio.load(content)
    const links = $(hrefFilter)
      .map((_, el) => {
        const href = $(el).attr('href')
        const date = $(el).closest('tr').find('td').text().trim()
        return { href, date }
      })
      .get()

    this.newsUrlList.push(
      ...links.map((link) => ({
        newsSite: this.newsSite,
        url: `${this.BASE_URL}${link.href}`,
        date: parse(link.date, 'dd.MM.yyyy', new Date()),
      })),
    )
  }

  async downloadANews(urlWithDate: UrlList): Promise<void> {
    const content = await this.getContentFromWebsite(urlWithDate.url)
    if (!content) {
      console.warn(`No content found for ${urlWithDate}`)
      return
    }

    const $ = cheerio.load(content)
    const title = $('.page-header h1').text().trim()
    const lead = $('.com-content-article__body strong').first().text().trim()

    const images: Partial<PostMedia>[] = []
    $('.imagebox').each(function () {
      const imageUrl = $(this).find('img').attr('src') || null
      const caption = $(this).find('.text').text().trim()

      images.push({
        imageUrl: `https://www.swiss-orienteering.ch${imageUrl}`,
        caption,
      })
    })

    this.newsListToSave.push({
      title,
      lead,
      sourceUrl: urlWithDate.url,
      date_created: (urlWithDate.date || new Date()).toISOString(),
      type: 'news-post',
      status: 'published',
      medias: images as PostMedia[],
    })
  }
}
