import ICrawler from '../types/ICrawler'
import axios, { AxiosResponse } from 'axios'
import moment from 'moment'
import csvjson from 'csvjson'
import ICsvParameters from '../types/ICsvParameters'
import { ISolvCsv } from '../types/ISolv'
import SolvRaces from '../classes/race/SolvRaces'
import Races from '../classes/race/Races'
import SolvRace from '../classes/race/SolvRace'
import Crawler, { CrawlerOptions } from '../classes/crawler/Crawler'

export default class Solv extends Crawler implements ICrawler {
  private readonly minYear: number
  private dataPath: string
  private readonly csvParameters: ICsvParameters
  dataSourceName: string

  constructor (options: CrawlerOptions) {
    super(options)
    // years available from 2001 (see: https://www.o-l.ch/cgi-bin/fixtures)
    this.minYear = moment().year()
    this.dataPath = 'crawler/solv/tmp_data/'
    this.dataSourceName = 'solv'
    this.csvParameters = {
      delimiter: ';'
    }
  }

  /**
   * Entry point and implementation of the ICrawler interface
   */
  async crawl () {
    try {
      return this.downloadCsv(this.minYear)
    } catch (e) {
      console.log(e)
      return false
    }
  }

  /**
   * download the csv file from the solv server
   */
  async downloadCsv (year: number): Promise<boolean | void> {
    // 1. download csv file
    console.log(`SOLV: Downloading CSV for ${year}...`)
    const url = `https://www.o-l.ch/cgi-bin/fixtures?&year=${year}&kind=-1&csv=1`
    const response: AxiosResponse = await axios({method:'GET', url, responseType:'arraybuffer'})
    // 2. encode buffer to latin1
    const racesCsvString = response.data.toString('latin1')
    // 3. convert from csv to json
    const solvRaces: ISolvCsv[] = csvjson.toSchemaObject(racesCsvString, this.csvParameters)
    // 4. save the data to strapi
    if (solvRaces.length) {
      console.log(`SOLV: Parse CSV...`)
      const races = new SolvRaces().parseSolvCsv(solvRaces, this.dataSourceName)
      console.log(`SOLV: Decorate races...`)
      await races.decorateRaces()
      console.log(`SOLV: Save races to Directus...`)
      await this.saveData(races)
      await this.downloadCsv(year += 1)
    } else {
      console.log('SOLV: All data crawled.')
      return true
    }
  }

  /**
   * TODO: AUTHENTICATE ON STRAPI!!
   * Saving data to strapi
   * @param races
   */
  async saveData (races: Races<SolvRace>): Promise<boolean> {
    try {
      const racesService = this.createItemsService('Race')

      racesService.

      const apiCompatibleRaces = races.getApiCompatibleRaces()
      await axiosInstance.put('api/race', apiCompatibleRaces)
      return true
    } catch (e) {
      console.log(e)
      return false
    }
  }
}
