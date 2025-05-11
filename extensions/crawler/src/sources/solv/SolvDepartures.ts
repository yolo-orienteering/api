import axios, { AxiosResponse } from 'axios'
import * as cheerio from 'cheerio'
import { DirectusUsers, Race, RaceCategory, UserDeparture } from '../../types/DirectusTypes'
import Crawler, { CrawlerOptions } from '../../classes/crawler/Crawler'
import ICrawler from '../../types/ICrawler'
import { ItemsService } from '@directus/api/dist/services/items'

interface RawDeparture {
  firstAndLastName?: string,
  birthYear?: number
  location?: string
  club?: string,
  startTime?: number
}

interface RawCategoryWithDepartures {
  raceCategory: Partial<RaceCategory>,
  departures: RawDeparture[]
}

export class SolvDepartures extends Crawler implements ICrawler {
  private racesHavingDepartures?: Race[]
  private racesService: ItemsService
  private raceCategoriesService: ItemsService
  private usersService: ItemsService
  private userDeparturesService: ItemsService

  constructor(options: CrawlerOptions) {
    super(options)
    this.racesService = this.createItemsService('Race')
    this.raceCategoriesService = this.createItemsService('RaceCategory')
    this.usersService = this.createItemsService('directus_users')
    this.userDeparturesService = this.createItemsService('UserDeparture')
  }

  public async crawl() {
    console.log('Start crawling solv departures.')

    // get races having departures
    await this.getRacesHavingDepartures()

    // get categories of each race
    await this.getCategoriesOfRacesAndSave()
  }

  private async getRacesHavingDepartures (): Promise<void> {
    const fiveDaysAgo = new Date()
    fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5)

    this.racesHavingDepartures = await this.racesService.readByQuery({
      filter: {
        departureLink: {
          _nnull: true
        },
        date: {
          _gte: fiveDaysAgo.toISOString()
        }
      },
      limit: -1
    }) as Race[]
  }
  
  private async getCategoriesOfRacesAndSave (): Promise<void> {
    if (!this.racesHavingDepartures) {
      console.warn(`No races having departure lists. Abort`)
      return
    }

    for (const race of this.racesHavingDepartures) {
      console.log(`Crawl categories of race id ${race.id}`)
      const html = await this.loadCategoriesOfRace(race)
      if (!html) {
        console.log(`Could not load categories of race id ${race.id}`)
        continue
      }
      const categoriesWithDepartures = await this.normalizeCategoriesOfRace(html, race)
      await this.saveData(race, categoriesWithDepartures)
    }
    console.log('Job finished. All departures saved.')
  }

  private async loadCategoriesOfRace (race: Race): Promise<false | string> {
    const response: AxiosResponse = await axios.get(`${race.departureLink}&kind=all`, {
      responseType: 'arraybuffer'
    })
    if (!response.data) {
      return false
    }
    return response.data.toString('latin1')
  }

  private async normalizeCategoriesOfRace (html: string, race: Race): Promise<RawCategoryWithDepartures[]> {
    const $ = cheerio.load(html)

    const rawCategoriesWithDepartures: RawCategoryWithDepartures[] = []

    $('b').each((index, element) => {
        const nextPreTag = $(element).next('pre')
        if (nextPreTag.length > 0) {
        const categoryName = $(element).text().trim()
        const preText = nextPreTag.text()
        const lines = preText.split('\n').filter(line => line.trim() !== '')

        // get category data out of first line
        const firstLine = lines[0]?.trim()
        const match = firstLine?.match(/\(\s*([\d.]+)\s*km,\s*([\d.]+)\s*m,\s*(\d+)\s*Po\.\s*\)/)

        if (match) {
          const [, distanceKm, equidistanceM, controls] = match

          const raceCategory: Partial<RaceCategory> = {
            name: categoryName,
            distanceInMeter: distanceKm ? parseFloat(distanceKm) * 1000 : undefined, // Convert km to meters
            equidistanceInMeter: equidistanceM ? parseFloat(equidistanceM) : undefined, // Already in meters
            amountOfControls: controls ? parseInt(controls, 10) : undefined, // Convert to integer
            race: race.id
          }
  
          // get departures
          const rawDepartures: RawDeparture[] = lines.map(line => {
            const match = line.match(/^\s*\d+\s+(.+?)\s+(\d{2})\s+(.+?)\s+(.+?)\s+(\d{1,2}:\d{2})$/)
            if (match) {
              const [, firstAndLastName, birthYear, location, club, startTime] = match
              return {
                firstAndLastName: firstAndLastName?.trim(),
                birthYear: this.parseBirthYear(birthYear?.trim()),
                location: location?.trim(),
                club: club?.trim(),
                startTime: this.parseStartTime(startTime?.trim())
              }
            }
            return null
          }).filter(item => item !== null)
  
          rawCategoriesWithDepartures.push({
            raceCategory,
            departures: rawDepartures
          })
        } else {
          console.warn(`Could not read category data of race id ${race.id}`)
        }
      }
    })

    return rawCategoriesWithDepartures
  }

  // taking a 2-digit birth year and returning full birth year including century
  private parseBirthYear(birthYear: string | undefined): number | undefined {
    if (!birthYear) {
      return undefined
    }
    const currentYear = new Date().getFullYear().toString()
    const currentYearShort = currentYear.slice(2)
    const birthYearInt = parseInt(birthYear, 10)
  
    if (birthYear > currentYearShort) {
      return 1900 + birthYearInt
    }
  
    return 2000 + birthYearInt
  }

  // taking a start time in format hh:mm and returning a start time,
  // representing minutes since midnight of a day
  private parseStartTime (rawStartTime: string | undefined): number | undefined {
    if (!rawStartTime) {
      return undefined
    }
    const [hours, minutes] = rawStartTime.split(':')
    if (!hours || !minutes) {
      return undefined
    }
    return (parseInt(hours, 10) * 60) + parseInt(minutes)
  }

  private async saveData (race: Race, categoriesWithDepartures: RawCategoryWithDepartures[]): Promise<void> {
    // 1. upsert race categories
    const rawRaceCategories: Partial<RaceCategory>[] = categoriesWithDepartures.map(categoryWith => categoryWith.raceCategory)
    const raceCategories = await this.saveRaceCategories(race, rawRaceCategories)

    // 2. upsert users
    const departureUsers = await this.saveUsers(categoriesWithDepartures)

    // 3. upsert departure times
    await this.saveDepartures({categoriesWithDepartures, raceCategories, users: departureUsers, race})
  }

  private async saveDepartures (
    {
      categoriesWithDepartures,
      raceCategories,
      users,
      race
    }: {
      categoriesWithDepartures: RawCategoryWithDepartures[],
      raceCategories: RaceCategory[],
      users: DirectusUsers[],
      race: Race
    })
  {
    console.log('Save departures...')
    let newUserDepartures: Partial<UserDeparture>[] = []

    // iterate through all categories
    for (const raceCategory of categoriesWithDepartures) {
      // iterate all departures
      for (const departure of raceCategory.departures) {
        const relatedRaceCategory = raceCategories.find(tmpRaceCategory => tmpRaceCategory.name === raceCategory.raceCategory.name)

        if (!relatedRaceCategory) {
          console.warn('Could not find related race category, but should exist.')
          continue
        }

        const userIdentifier = this.getUserIdentifierFromRawDeparture(departure)
        const relatedUser = users.find(tmpUser => tmpUser.composedIdentifierSolv === userIdentifier) 
        if (!relatedUser) {
          console.warn('Could not find related user, but should exist.')
          continue
        }

        newUserDepartures.push({
          raceCategory: relatedRaceCategory.id,
          user: relatedUser.id,
          startTimeInMinutes: departure.startTime,
          race: race.id
        })
      }
    }

    const existingDepartures = await this.userDeparturesService.readByQuery({
      filter: {
        race: {
          id: {
            _eq: race.id
          }
        }
      },
      fields: ['id', 'race', 'raceCategory', 'user'],
      limit: -1
    }) as UserDeparture[]

    // merge existing departures with crawled ones
    if (existingDepartures.length) {
      newUserDepartures = newUserDepartures.map(newUserDeparture => {
        const existingUserDeparture = existingDepartures.find(existingDeparture => {
          return existingDeparture.user === newUserDeparture.user &&
          existingDeparture.race === newUserDeparture.race
        })
        if (!existingUserDeparture) {
          return newUserDeparture
        }
        return {
          ...existingUserDeparture,
          ...newUserDeparture
        }
      })
    }
    await this.userDeparturesService.upsertMany(newUserDepartures)
  }

  private async saveUsers (categoriesWithDepartures: RawCategoryWithDepartures[]): Promise<DirectusUsers[]> {
    console.log('save users...')
    let users: Partial<DirectusUsers>[] = []

    for (const categoryWithDepartures of categoriesWithDepartures) {
      for (const departure of categoryWithDepartures.departures) {
        const [firstName, ...lastNameParts] = departure.firstAndLastName?.split(' ') || []
        users.push({
          composedIdentifierSolv: this.getUserIdentifierFromRawDeparture(departure),
          first_name: firstName,
          last_name: lastNameParts.join(' '),
          birthYear: departure.birthYear,
          status: 'unverified'
        })
      }
    }

    // get existing users
    const existingUsers = await this.usersService.readByQuery({
      filter: {
        composedIdentifierSolv: {
          _in: users.map(userToSave => userToSave.composedIdentifierSolv) as string[]
        }
      },
      fields: ['id', 'composedIdentifierSolv', 'status'],
      limit: -1
    }) as DirectusUsers[]

    if (existingUsers.length) {
      users = users.map(user => {
        const existingUser = existingUsers.find(existingUser => existingUser.composedIdentifierSolv === user.composedIdentifierSolv)
        if (!existingUser) {
          return user
        }
        return {
          ...existingUser,
          ...user
        }
      })
    }

    const savedUserIds = await this.usersService.upsertMany(users)
    return await this.usersService.readMany(savedUserIds, {
      fields: ['id', 'first_name', 'last_name', 'composedIdentifierSolv', 'birthYear']
    }) as DirectusUsers[]
  }

  private getUserIdentifierFromRawDeparture (departure: RawDeparture): string {
    return `${departure.firstAndLastName?.replace(/\s+/g, '').toLowerCase()}${departure.birthYear}`
  } 

  private async saveRaceCategories (race: Race, raceCategories: Partial<RaceCategory>[]): Promise<RaceCategory[]> {
    console.log('save race categories...')
    let categoryNames = raceCategories
      .map(raceCategory => raceCategory.name)
      .filter(categoryName => !!categoryName) as string[]

    // read existing race categories
    const existingRaceCategories = await this.raceCategoriesService.readByQuery({
      filter: {
        _and: [
          {
            race: {
              id: {
                _eq: race.id
              }
            },
            name: {
              _in: categoryNames
            }
          }
        ]
      },
      limit: -1
    }) as RaceCategory[]

    

    // merge existing race categories with crawled ones
    if (existingRaceCategories.length) {
      raceCategories = raceCategories.map(raceCategory => {
        const existingRaceCategory = existingRaceCategories.find(existing => existing.name == raceCategory.name)
        if (!existingRaceCategory) {
          return raceCategory
        }
        // merge existing with crawled one
        return {
          ...existingRaceCategory,
          ...raceCategory
        }
      })
    }

    const upsertedIds = await this.raceCategoriesService.upsertMany(raceCategories)
    return await this.raceCategoriesService.readMany(upsertedIds, {
      fields: ['id', 'name']
    }) as RaceCategory[]
  }
}