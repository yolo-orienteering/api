import axios, { AxiosResponse } from 'axios'
import * as cheerio from 'cheerio'
import { Race } from '../types/DirectusTypes'
import { ISolvLinkIdentifier } from '../../types/ISolv'

export default class SolvDecorator {
  private readonly BASE_URL: string
  private readonly FIXTURES_PATH: string
  private readonly LINK_IDENTIFIER: ISolvLinkIdentifier
  public race: Race

  constructor({race}: {race: Race}) {
    this.race = race
    this.BASE_URL = 'https://www.o-l.ch/cgi-bin/'
    this.FIXTURES_PATH = 'fixtures?&mode=show&unique_id='
    this.LINK_IDENTIFIER = {
      publicationLink: 'Ausschreibung',
      rankingLink: 'Rangliste',
      departureLink: 'Startliste',
      inscriptionLink: ['pico', 'GO2OL', 'OL-Events'],
      liveResultLink: 'Live'
    }
  }

  /**
   * Entry point of this class. Used to complete race information by crawling from other solv sources than csv.
   */
  public async decorate (): Promise<void> {
    const html: string | false = await this.loadSite()
    if (!html) {
      return
    }
    this.decorateRace(html)
  }

  /**
   * Fetch SOLV site as html string
   * @private
   */
  private async loadSite (): Promise<string | false> {
    const originalDataId = this.race.originalDataId
    const response: AxiosResponse = await axios.get(`${this.BASE_URL}${this.FIXTURES_PATH}${originalDataId}`, {
      responseType: 'document'
    })
    if (!response.data) {
      return false
    }
    return response.data
  }

  /**
   * Decorate races with defined link identifier
   * @param html
   * @param race
   * @private
   */
  private decorateRace (html: string): void {
    const $ = cheerio.load(html)
    
    this.decorateWithLinks($)
    this.decorateWithTerrain($)
    this.decorateWithDistance($)
  }

  private decorateWithLinks ($: cheerio.CheerioAPI): void {
    $('a').each( (_index, value) => {
      const text = $(value).text()
      let link = $(value).attr('href')
      // complete link
      if (!link?.startsWith('https://')) {
        link = this.BASE_URL + link
      }
      // publicationLink
      if (text.includes(this.LINK_IDENTIFIER.publicationLink)) {
        this.race.publicationLink = link
      }
      // rankingLink
      if (text.includes(this.LINK_IDENTIFIER.rankingLink)) {
        this.race.rankingLink = link
      }
      // liveResultLink
      if (text.includes(this.LINK_IDENTIFIER.liveResultLink)) {
        this.race.liveResultLink = link
      }
      // inscriptionLink
      const hasInscriptionLink = this.LINK_IDENTIFIER.inscriptionLink.find((inscriptionLink: string) => text.includes(inscriptionLink))
      if (hasInscriptionLink) {
        this.race.inscriptionLink = link
      }

      if (text.includes(this.LINK_IDENTIFIER.departureLink)) {
        this.race.departureLink = link
      }
    })
  }

  private decorateWithTerrain ($: cheerio.CheerioAPI): void {
    const terrainRow = $('tr').filter((_index, element) => {
      return $(element).find('td').first().text().trim() === 'Terrain:'
    })

    if (terrainRow.length > 0) {
      const terrain = terrainRow.find('td').eq(1).text().trim().toLowerCase()

      if (terrain.includes('urban')) {
        this.race.terrain = 'urban'
      } else if (terrain.includes('wald')) {
        this.race.terrain = 'forest'
      } else if (terrain.includes('mix')) {
        this.race.terrain = 'mix'
      }
    }
  }

  private decorateWithDistance ($: cheerio.CheerioAPI): void {
    const distanceRow = $('tr').filter((_index, element) => {
      return $(element).find('td').first().text().trim() === 'Distanz:'
    })

    if (distanceRow.length > 0) {
      const distance = distanceRow.find('td').eq(1).text().trim().toLowerCase()

      if (distance.includes('sprint')) {
        this.race.distance = 'sprint'
      } else if (distance.includes('mittel')) {
        this.race.distance = 'middle'
      } else if (distance.includes('lang')) {
        this.race.distance = 'long'
      }
    }
  }
}
