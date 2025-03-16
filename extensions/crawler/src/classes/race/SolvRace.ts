import Race from './Race'
import SolvDecorator from '../../crawler/solv/SolvDecorator'
import {PropertiesOnly} from '../../interfacesAndTypes/Utilities'

export default class SolvRace extends Race {
  constructor (props: PropertiesOnly<Race>) {
    super({...props})
  }

  /**
   * Decorate race with links such as publicationLink or rankingLink.
   */
  public async decorateRace (): Promise<void> {
    await new SolvDecorator({race: this}).decorate()
  }
}
