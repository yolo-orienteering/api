import Races from './Races'
import { ISolvCsv } from '../../interfacesAndTypes/ISolv'
import moment from 'moment'
import SolvRace from './SolvRace'

export default class extends Races<SolvRace> {
  constructor() {
    super()
  }

  /**
   * Complete races with information not available in csv.
   */
  public async decorateRaces (): Promise<void> {
    for (const race of this.races) {
      if (race.originalDataId && race instanceof SolvRace) {
        console.log(`SOLV: Decorate race id ${race.originalDataId}...`)
        await race.decorateRace()
      } else {
        console.log(`SOLV: Skipping race decoration for id ${race.originalDataId}`)
      }
    }
  }

  /**
   * Parse csv races from solv into races array
   * @param solvRaces
   * @param dataSourceName
   */
  public parseSolvCsv(solvRaces: ISolvCsv[], dataSourceName: string): this {
    this.races = []
    for (const solvRace of solvRaces) {
      const race = new SolvRace({
        originalDataFull: solvRace,
        originalDataId: solvRace.unique_id,
        originalDataSource: dataSourceName,
        deadline: solvRace.deadline ? moment(solvRace.deadline) : null,
        date: solvRace.date ? moment(solvRace.date) : null,
        name: solvRace.event_name,
        eventLink: solvRace.event_link,
        country: 'switzerland',
        region: solvRace.region,
        city: solvRace.location,
        relevance: solvRace.national === '1' ? 'national' : null,
        mapName: solvRace.map,
        updatedAt: moment(),
        publishedAt: moment()
      })
      this.races.push(race)
    }
    return this
  }

}
