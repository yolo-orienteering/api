import { ItemsService } from '@directus/api/dist/services/items'
import Crawler, { CrawlerOptions } from '../../classes/crawler/Crawler'
import ICrawler from '../../types/ICrawler'
import { Race } from '../../types/DirectusTypes'
import puppeteer, { Page } from 'puppeteer'
import * as cheerio from 'cheerio'

export class SolvInstructions extends Crawler implements ICrawler {
  private racesHavingWebsites?: Race[]
  private racesService: ItemsService
  private browserPage?: Page

  constructor(options: CrawlerOptions) {
    super(options)
    this.racesService = this.createItemsService('Race')
  }

  public async crawl () {
    console.log('Start crawling solv instructions.')

    await this.getRacesHavingWebsites()

    await this.setupBrowserPage()

    await this.findLinkOnWebsites()
    console.log('Job done. Crawled for all instruction links.')
  }

  private async setupBrowserPage (): Promise<void> {
    console.log('Initialize headless browser and setup page.')
    const browser = await puppeteer.launch()
    this.browserPage = await browser.newPage()
    await this.browserPage.setViewport({width: 1920, height: 1080})
  }

  private async getRacesHavingWebsites (): Promise<void> {
    console.log('Load races having a website url.')
    const today = new Date()
    const inAMonth = new Date(new Date().setDate(new Date().getDate() + 30))
    this.racesHavingWebsites = await this.racesService.readByQuery({
      filter: {
        eventLink: {
          _nnull: true
        },
        _and: [
          {
            date: {
              _gte: today.toISOString()
            }
          }, {
            date: {
              _lt: inAMonth.toISOString()
            }
          }
        ]
      },
      limit: -1
    }) as Race[]
  }

  private async findLinkOnWebsites (): Promise<void> {
    console.log('Find links on websites')
    for (const {id, eventLink} of this.racesHavingWebsites || []) {
      if (!eventLink) { // there is no event link
        continue
      } else if (eventLink.endsWith('.pdf')) { // event link is already a pdf. take it as instruction link
        await this.racesService.updateOne(id, {instructionLink: eventLink})
      } else { // event link is a website. find the instruction link
        await this.findLinkOnWebsite(id, eventLink)
      }
    }
  }

  private async findLinkOnWebsite (id: string, url: string, depth: number = 0): Promise<void> {
    const MAX_DEPTH = 2
    const content = await this.getContentFromWebsite(url)
    if (!content) {
      console.warn(`Website content from ${url} was unexpectedly empty.`)
      return
    }

    // get a link out of the website content
    // todo: italian is missing
    const $ = cheerio.load(content)
    let link = $('a').filter((_, el) => {
      const href = $(el).attr('href')?.toLowerCase() || ''
      const text = $(el).text().toLowerCase()
      const otherProps = Object.values(el.attribs).join(' ').toLowerCase()
      const keywords = ['ausschreibung', 'bulletin', 'directive']
      if (depth > 0) {
        keywords.push('download')
      }
      return keywords.some(keyword => 
        href.includes(keyword) || text.includes(keyword) || otherProps.includes(keyword)
      )
    }).attr('href')

    // no link found
    if (!link) {
      return
    }

    // get full link with host, if relativ pathes were used
    let instructionLink = link
    if (link && !link.startsWith('http')) {
      const origin = new URL(url).origin
      instructionLink = `${origin}${link.startsWith('/') ? '' : '/'}${link}`;
    }
    
    const linkLeadsTo = await this.getTypeOfInstructionLink(instructionLink)

    if (linkLeadsTo === 'pdf') { // valid instruction pdf. save it
      await this.racesService.updateOne(id, {instructionLink})
      return
    } else if (depth >= MAX_DEPTH) { // exit recursion because of search depth
      return
    } else if (linkLeadsTo === 'html') { // follow the link
      await this.findLinkOnWebsite(id, instructionLink, (depth + 1))
    } else {
      return
    }
  }

  private async getTypeOfInstructionLink (instructionLink: string): Promise<'pdf' | 'html' | 'unknown'> {
    try {
      const response = await fetch(instructionLink, { method: 'HEAD' });
      const contentType = response.headers.get('content-type');

      if (contentType?.includes('application/pdf')) {
        return 'pdf'
      } else if (contentType?.includes('text/html')) {
        return 'html'
      } else {
        return 'unknown'
      }
    } catch (error) {
      console.warn(`Failed to check the instruction link: ${instructionLink}`, error)
      return 'unknown'
    }
  }

  private async getContentFromWebsite (url: string): Promise<string | undefined> {
    console.log('Reading website content')
    if (!this.browserPage) {
      console.warn('Browser page is not available. Initialization missing?')
      return
    }
    try {
      await this.browserPage.goto(url, {
        waitUntil: 'networkidle2'
      })
      return this.browserPage.content()
    } catch (error) {
      console.warn(`could not open ${url}`)
      return
    }
  }
}