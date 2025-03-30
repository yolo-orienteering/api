import ICrawler from '../../types/ICrawler'
import axios, { AxiosResponse } from 'axios'
import csvjson from 'csvjson'
import ICsvParameters from '../../types/ICsvParameters'
import { ISolvCsv } from '../../types/ISolv'
import Crawler, { CrawlerOptions } from '../../classes/crawler/Crawler'
import { Race as RaceWithId } from '../../types/DirectusTypes'
import SolvDecorator from './SolvDecorator'

type Race = Omit<RaceWithId, 'id'>

export default class Solv extends Crawler implements ICrawler {
  private readonly minYear: number
  private readonly csvParameters: ICsvParameters

  constructor (options: CrawlerOptions) {
    super(options)
    // years available from 2001 (see: https://www.o-l.ch/cgi-bin/fixtures)
    this.minYear = new Date().getFullYear()
    this.csvParameters = {
      delimiter: ';'
    }
  }

  /**
   * Entry point and implementation of the ICrawler interface
   */
  public async crawl (): Promise<boolean> {
    try {
      let currentYear = this.minYear
      while (currentYear) {
        const solvRaces: ISolvCsv[] = await this.downloadCsv(currentYear)

        // stop crawling
        if (!solvRaces.length) {
          console.log('SOLV: All data crawled.')
          break
        }

        // parse solve races to Directus races
        const races = this.solvRacesToRaces(solvRaces)
        const decoratedRaces = await this.decorateRaces(races)
        await this.saveRaces(decoratedRaces)
        currentYear++
      }
      return true
    } catch (e) {
      console.log(e)
      return false
    }
  }

  /**
   * download the csv file from the solv server
   */
  private async downloadCsv (year: number): Promise<ISolvCsv[]> {
    // 1. download csv file
    console.log(`SOLV: Downloading CSV for ${year}...`)
    const url = `https://www.o-l.ch/cgi-bin/fixtures?&year=${year}&kind=-1&csv=1`
    const response: AxiosResponse = await axios({method:'GET', url, responseType:'arraybuffer'})
    // 2. encode buffer to latin1
    const racesCsvString = response.data.toString('latin1')
    // 3. convert from csv to json
    return csvjson.toSchemaObject(racesCsvString, this.csvParameters)
  }

  /**
   * Parse the csv to Race objects
   * @param solvRaces 
   * @returns 
   */
  private solvRacesToRaces (solvRaces: ISolvCsv[]): Race[] {
    console.log(`SOLV: Parse CSV...`)
    return solvRaces.map(solvRace => ({
      originalDataFull: solvRace,
      originalDataSource: this.dataSourceName,
      originalDataId: solvRace.unique_id,
      status: 'published',
      name: solvRace.event_name,
      date: solvRace.date ? new Date(solvRace.date).toISOString() : null,
      deadline: solvRace.deadline ? new Date(solvRace.deadline).toISOString() : null,
      country: 'switzerland',
      region: solvRace.region,
      city: solvRace.location,
      geographicalScale: solvRace.national === '1' ? 'national' : null,
      mapName: solvRace.map,
      eventLink: solvRace.event_link
    }))
  }

  /**
   * Iterates over an array of Race objects and decorates each race with additional information
   * by using the SolvDecorator class. If a race has an `originalDataId`, it fetches and processes
   * additional data from an external source. If no `originalDataId` is present, the race is skipped.
   * 
   * Logs the progress of the decoration process for debugging purposes.
   * 
   * @param races - An array of Race objects to be decorated.
   * @returns A Promise that resolves to the array of decorated Race objects.
   */
  private async decorateRaces (races: Race[]): Promise<Race[]> {
    console.log(`SOLV: Decorate races...`)
    for (const race of races) {
      if (race.originalDataId) {
        console.log(`SOLV: Decorate race id ${race.originalDataId}...`)
        await new SolvDecorator({race}).decorate()
      } else {
        console.log(`SOLV: Skipping race decoration for id ${race.originalDataId}`)
      }
    }
    return races
  }

  /**
   * Saving data to Directus
   * @param races
   */
  private async saveRaces (races: Race[]): Promise<boolean> {
    try {
      console.log('Checking for existing races in database to be updated...')
      const racesService = this.createItemsService('Race')

      // prepare filter
      const orFilterOfExistingRaces = races.map(race => {
        return {
          _and: [
            {
              originalDataSource: {
                _eq: race.originalDataSource
              }
            },
            {
              originalDataId: {
                _eq: race.originalDataId
              }
            }
          ]
        }
      })

      const existingRaces = await racesService.readByQuery({
        filter: {
          _or: orFilterOfExistingRaces
        },
        limit: -1
      })

      // merge existing races with crawled one
      if (existingRaces.length) {
        console.log('Merging existing races with new data...')
        races = races.map(race => {
          const existingRace = existingRaces.find(existingRace => existingRace.originalDataSource === race.originalDataSource && existingRace.originalDataId === race.originalDataId)
          // no existing race found. simply return the crawled
          if (!existingRace) {
            return race
          }
          // merge existing with crawled race
          return {
            ...existingRace,
            ...race
          }
        })
      }

      console.log('Saving races to Directus...')
      await racesService.upsertMany(races)
      return true
    } catch (e) {
      console.log(e)
      return false
    }
  }
}
