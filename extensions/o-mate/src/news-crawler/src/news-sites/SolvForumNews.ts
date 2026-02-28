import { parseISO } from 'date-fns'
import * as cheerio from 'cheerio'
import { UrlList } from '../NewsCrawler'
import { NewsSiteAdapter } from './NewsSiteAdapter'

export class SolvForumNews extends NewsSiteAdapter {
  BASE_URL: string = 'https://www.swiss-orienteering.ch'

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

    // Select rows with class 'category' in the forum list
    $('tr.category').each((_, el) => {
      const $el = $(el)
      // Find title link. It has class 'topictitle'
      const $link = $el.find('.topictitle').first()
      const href = $link.attr('href')

      if (href) {
        const fullUrl = `${this.BASE_URL}${href}`

        // We do not have absolute date here easily (it's relative like "1 Tag her"),
        // so we will fetch the exact date in downloadANews from the detail page
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
    let date = new Date()

    const content = await this.getContentFromWebsite(url)

    if (!content) {
      console.warn(`No content found for ${url}`)
      return
    }

    const $ = cheerio.load(content)

    // Extract Title
    // usually in the breadcrumb or h1. On forum page it might be in .topic-title or similar.
    // Let's rely on the first .topictitle in the message header if available, or fetch h1
    // The previous analysis showed: <a ... class="hasTooltip topictitle">Postendiebstahl</a> inside .mykmsg-header
    let title = $('.mykmsg-header .topictitle').first().text().trim()
    if (!title) {
      title = $('h1').first().text().trim()
    }

    // Extract User Name
    // Based on <div class="mykmsg-header"> ... <em><a class="kwho-user ...">Name</a></em></div>
    const forumUserName = $('.mykmsg-header .kwho-user').first().text().trim()

    // Extract Lead / Content
    // The content is in div.kmsg
    // We take the text content, maybe limit length if needed, but for 'lead' we usually take the start.
    const $messageBody = $('.kmsg').first()
    let lead = $messageBody.text().trim()

    // Clean up lead if it's too long or has weird spacing
    if (lead.length > 300) {
      lead = lead.substring(0, 300) + '...'
    }

    // Extract Date
    // Try to find JSON-LD
    const jsonLd = $('script[type="application/ld+json"]').html()
    if (jsonLd) {
      try {
        const data = JSON.parse(jsonLd)
        if (data.datePublished) {
          date = parseISO(data.datePublished)
        }
      } catch (e) {
        console.warn('Failed to parse JSON-LD for date', e)
      }
    } else {
      // Fallback: try the tooltip on date element
      // <span class="kdate " data-bs-toggle="tooltip" title="27 Feb. 2026 09:23">1 Tag 11 Stunden her</span>
      const dateTitle = $('.kdate').first().attr('title')
      // format: "27 Feb. 2026 09:23"
      if (dateTitle) {
        // Need to parse "27 Feb. 2026 09:23"
        // Simple parsing or use date-fns if locale matches
        // Let's try to convert month names to numbers if needed or just use Date.parse
        // German month names might require mapping
        const germanMonths: { [key: string]: string } = {
          'Jan.': 'Jan',
          'Feb.': 'Feb',
          März: 'Mar',
          'Apr.': 'Apr',
          Mai: 'May',
          Juni: 'Jun',
          Juli: 'Jul',
          'Aug.': 'Aug',
          'Sep.': 'Sep',
          'Okt.': 'Oct',
          'Nov.': 'Nov',
          'Dez.': 'Dec',
        }
        let dateStr = dateTitle
        for (const [de, en] of Object.entries(germanMonths)) {
          dateStr = dateStr.replace(de, en)
        }
        const d = new Date(dateStr)
        if (!isNaN(d.getTime())) {
          date = d
        }
      }
    }

    this.newsListToSave.push({
      title,
      lead,
      sourceUrl: url,
      date_created: date.toISOString(),
      type: 'forum-post',
      status: 'published',
      forumUserName: forumUserName || null,
    })
  }
}
