import Race from './Race'

export default class Races<T extends Race> {
  public races: T[]

  constructor () {
    this.races = []
  }
  public getApiCompatibleRaces () {
    return this.races.map((race: Race) => race.getCompatibleApiFormat())
  }
}
