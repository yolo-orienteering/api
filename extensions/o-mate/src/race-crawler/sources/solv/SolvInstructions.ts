import { ItemsService } from '@directus/api/dist/services/items'
import Crawler, { CrawlerOptions } from '../../classes/crawler/Crawler'
import ICrawler from '../../types/ICrawler'
import { Race } from '../../types/DirectusTypes'
import puppeteer, { Browser, Page } from 'puppeteer'
import * as cheerio from 'cheerio'

export class SolvInstructions extends Crawler implements ICrawler {
  private racesHavingWebsites?: Race[]
  private racesService: ItemsService
  private raceInstructionsService: ItemsService
  private browser?: Browser
  private browserPage?: Page
  private instructionLinkCounter: number

  constructor(options: CrawlerOptions) {
    super(options)
    this.racesService = this.createItemsService('Race')
    this.raceInstructionsService = this.createItemsService('RaceInstruction')
    this.instructionLinkCounter = 0
  }

  public async crawl () {
    try {
      console.log('Start crawling solv instructions.')

      await this.getRacesHavingWebsites()

        await this.setupBrowserPage()

        await this.findLinkOnWebsites()
        
        console.log(`Job done. Found and saved ${this.instructionLinkCounter} instruction links.`)
    } catch (e) {
      console.error('Instruction crawling job finished unexpectedly with an error', e)
    } finally {
      this.browser?.close()
    }
  }

  private async setupBrowserPage (): Promise<void> {
    this.browser = await puppeteer.launch({headless: true, args: ['--no-sandbox']})
    this.browserPage = await this.browser.newPage()
    await this.browserPage.setViewport({width: 1920, height: 1080})
  }

  private async getRacesHavingWebsites (): Promise<void> {
    const today = new Date()
    const inTwoMonth = new Date(new Date().setDate(new Date().getDate() + (30 * 2)))
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
              _lt: inTwoMonth.toISOString()
            }
          }
        ]
      },
      limit: -1
    }) as Race[]
  }

  private async findLinkOnWebsites (): Promise<void> {
    for (const {id, eventLink, name} of this.racesHavingWebsites || []) {
      if (!eventLink) { // there is no event link
        continue
      } else if (eventLink.endsWith('.pdf')) { // event link is already a pdf. take it as instruction link
        await this.racesService.updateOne(id, {instructionLink: eventLink})
      } else { // event link is a website. find the instruction link
        console.log(`Reading website of race ${name} to find instruction link.`)
        await this.findLinkOnWebsite(id, eventLink)
      }
    }
  }

  private async findLinkOnWebsite (id: string, url: string): Promise<void> {
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
      const keywords = ['weisung', 'bulletin', 'directive']
      return keywords.some(keyword => 
        href.includes(keyword) || text.includes(keyword) || otherProps.includes(keyword)
      )
    }).attr('href')

    // no link found
    if (!link) {
      console.log('No link found.')
      return
    }

    // get full link with host, if relativ pathes were used
    let instructionLink = link
    if (link && !link.startsWith('http')) {
      // consider base tags https://www.w3schools.com/tags/tag_base.asp
      const baseHref = $('base').attr('href');
      if (baseHref) {
        const baseUrl = new URL(baseHref, url);
        instructionLink = new URL(link, baseUrl).toString();
      } else {
        const origin = new URL(url).origin;
        instructionLink = `${origin}${link.startsWith('/') ? '' : '/'}${link}`;
      }
    }

    console.log('Found link and store it.')

    // save instruction link
    const raceInstruction = await this.raceInstructionsService.readByQuery({
      filter: {
        race: {
          _eq: id
        }
      }
    })
    await this.raceInstructionsService.upsertOne({
      id: raceInstruction?.[0]?.id,
      race: id,
      linkCrawled: instructionLink
    })
    this.instructionLinkCounter++
  }

  private async getContentFromWebsite (url: string): Promise<string | undefined> {
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
      return
    }
  }
}