import {Moment} from 'moment'
import { ISolvCsv } from '../../interfacesAndTypes/ISolv'
import {RaceRelevance} from '../../interfacesAndTypes/Strapi'
import {PropertiesOnly} from '../../interfacesAndTypes/Utilities'

export default class Race {
  public originalDataFull: ISolvCsv
  public originalDataId: string
  public originalDataSource: string
  public deadline: Moment
  public date: Moment
  public name: string
  public country: string
  public region: string
  public city: string
  public eventLink?: string
  public publicationLink?: string
  public rankingLink?: string
  public inscriptionLink?: string
  public liveResultLink?: string
  public relevance?: RaceRelevance
  public mapName?: string
  public updatedAt: Moment
  public publishedAt: Moment

  constructor(props: PropertiesOnly<Race>) {
    this.originalDataFull = props.originalDataFull
    this.originalDataId = props.originalDataId
    this.originalDataSource = props.originalDataSource
    this.deadline = props.deadline
    this.date = props.date
    this.name = props.name
    this.country = props.country
    this.region = props.region
    this.city = props.city
    this.eventLink = props.eventLink
    this.publicationLink = props.publicationLink
    this.rankingLink = props.rankingLink
    this.inscriptionLink = props.inscriptionLink
    this.liveResultLink = props.liveResultLink
    this.relevance = props.relevance
    this.mapName = props.mapName
    this.updatedAt = props.updatedAt
    this.publishedAt = props.publishedAt
  }

  public getCompatibleApiFormat () {
    return {
      originalDataFull: this.originalDataFull,
      originalDataId: this.originalDataId,
      originalDataSource: this.originalDataSource,
      deadline: this.deadline ? this.deadline.toISOString() : null,
      date: this.date ? this.date.format('YYYY-MM-DD') : null,
      name: this.name,
      eventLink: this.eventLink,
      publicationLink: this.publicationLink,
      rankingLink: this.rankingLink,
      inscriptionLink: this.inscriptionLink,
      liveResultLink: this.liveResultLink,
      country: this.country,
      region: this.region,
      city: this.city,
      relevance: this.relevance,
      mapName: this.mapName,
      updatedAt: this.updatedAt.toISOString(),
      publishedAt: this.publishedAt.toISOString()
    }
  }
}
