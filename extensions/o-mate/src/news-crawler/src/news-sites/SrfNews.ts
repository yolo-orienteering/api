import { parseISO } from 'date-fns'
import { PostMedia } from '../../../types/DirectusTypes'
import { UrlList } from '../NewsCrawler'
import { NewsSiteAdapter } from './NewsSiteAdapter'
import * as cheerio from 'cheerio'

export class SrfNews extends NewsSiteAdapter {
  BASE_URL: string = 'https://www.srf.ch'

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

    $('.collection__teaser-list .teaser').each((_, el) => {
      const href = $(el).attr('href')
      const dateString = $(el).attr('data-date-published')

      if (href && dateString) {
        links.push({
          newsSite: this.newsSite,
          url: href.startsWith('http') ? href : `${this.BASE_URL}${href}`,
          date: parseISO(dateString),
        })
      }
    })

    this.newsUrlList.push(...links)
  }

  async downloadANews(urlWithDate: UrlList): Promise<void> {
    const { url, date } = urlWithDate

    const content = await this.getContentFromWebsite(url)

    if (!content) {
      console.warn(`No content found for ${url}`)
      return
    }

    const $ = cheerio.load(content)

    const overline = $('.article-title__overline').text().trim()
    const headline = $('.article-title__text').text().trim()
    const title = overline ? `${overline} - ${headline}` : headline

    let lead = $('.article-list li')
      .map((_, el) => $(el).text().trim())
      .get()
      .join(' ')

    if (!lead) {
      lead = $('.article-paragraph').first().text().trim()
    }

    const images: Partial<PostMedia>[] = []

    // 1. Get main image from meta tag
    const metaImage = $('meta[itemprop="image"]').attr('content')
    if (metaImage) {
      images.push({
        imageUrl: metaImage,
        caption: title,
      })
    }

    // 2. Get images from article body
    $('.image-figure').each((_, el) => {
      const $el = $(el)
      const caption = $el.find('.media-caption__description').text().trim()
      const $imgContainer = $el.find('.js-image')
      const provider = $imgContainer.data('image-provider')
      const imageId = $imgContainer.data('image-id')
      let imageUrl: string | undefined

      const src = $el.find('img').attr('src')
      if (src && src.startsWith('http')) {
        imageUrl = src
      } else if (provider === 'rokka' && imageId) {
        // Construct Rokka URL if possible
        imageUrl = `https://www.srf.ch/static/cms/images/960w/${imageId}.jpg`
      } else if (provider === 'il' && imageId) {
        // Construct IL URL if possible - usually imageId is a full URL but maybe encoded
        imageUrl = imageId as string
      }

      if (imageUrl && !images.some((img) => img.imageUrl === imageUrl)) {
        images.push({
          imageUrl,
          caption,
        })
      }
    })

    this.newsListToSave.push({
      title,
      lead,
      sourceUrl: url,
      date_created: (date || new Date()).toISOString(),
      type: 'news-post',
      status: 'published',
      medias: images as PostMedia[],
    })
  }
}
