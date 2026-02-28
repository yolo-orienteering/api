import type { DirectusUser, DirectusFile } from '@directus/sdk'

export interface Schema {
  Game: Game[]
  GameAuthor: GameAuthor[]
  GameCategory: GameCategory[]
  GameVariant: GameVariant[]
  Game_GameCategory: GameGameCategory[]
  Post: Post[]
  PostMedia: PostMedia[]
  Race: Race[]
  RaceCategory: RaceCategory[]
  RaceInstruction: RaceInstruction[]
  UserDeparture: UserDeparture[]
  directus_sync_id_map: DirectusSyncIdMap[]
  directus_users: CustomDirectusUser
}

export interface Game {
  id: string
  status: 'published' | 'draft' | 'archived'
  sort: number | null
  user_created: string | DirectusUser<Schema> | null
  date_created: string | null
  user_updated: string | DirectusUser<Schema> | null
  date_updated: string | null
  subtitle: string | null
  title: string | null
  description: string | null
  image: string | DirectusFile<Schema> | null
  author: string | GameAuthor | null
  categories: string[] | GameGameCategory[]
  variants: string[] | GameVariant[]
}

export interface GameAuthor {
  id: string
  sort: number | null
  user_created: string | DirectusUser<Schema> | null
  date_created: string | null
  user_updated: string | DirectusUser<Schema> | null
  date_updated: string | null
  name: string
  url: string
}

export interface GameCategory {
  id: string
  status: 'published' | 'draft' | 'archived'
  sort: number | null
  user_created: string | DirectusUser<Schema> | null
  date_created: string | null
  user_updated: string | DirectusUser<Schema> | null
  date_updated: string | null
  name: string
  icon: string
}

export interface GameVariant {
  id: string
  status: 'published' | 'draft' | 'archived'
  sort: number | null
  user_created: string | DirectusUser<Schema> | null
  date_created: string | null
  user_updated: string | DirectusUser<Schema> | null
  date_updated: string | null
  title: string
  externalUrl: string | null
  openOutsideApp: boolean | null
  game: string | Game | null
}

export interface GameGameCategory {
  id: number
  Game_id: string | Game | null
  GameCategory_id: string | GameCategory | null
  sort: number | null
}

export interface Post {
  id: string
  status: 'published' | 'draft' | 'archived'
  sort: number | null
  user_created: string | DirectusUser<Schema> | null
  date_created: string | null
  user_updated: string | DirectusUser<Schema> | null
  date_updated: string | null
  type: 'user-post' | 'news-post' | null
  sourceUrl: string | null
  title: string | null
  lead: string | null
  medias: string[] | PostMedia[]
}

export interface PostMedia {
  id: string
  status: 'published' | 'draft' | 'archived'
  sort: number | null
  user_created: string | DirectusUser<Schema> | null
  date_created: string | null
  user_updated: string | DirectusUser<Schema> | null
  date_updated: string | null
  post: string | Post | null
  imageUrl: string | null
  youtubeUrl: string | null
  caption: string | null
}

export interface Race {
  city: string | null
  country: string | null
  date: string | null
  date_created: string | null
  date_updated: string | null
  deadline: string | null
  departureLink: string | null
  eventLink: string | null
  geographicalScale: 'national' | 'international' | 'regional' | null
  id: string
  inscriptionLink: string | null
  instructionLink: string | null
  liveResultLink: string | null
  mapName: string | null
  name: string | null
  originalDataFull: unknown | null
  originalDataId: string | null
  originalDataSource: 'solv' | null
  publicationLink: string | null
  rankingLink: string | null
  region: string | null
  sort: number | null
  status: 'published' | 'draft' | 'archived'
  user_created: string | DirectusUser<Schema> | null
  user_updated: string | DirectusUser<Schema> | null
  terrain: 'urban' | 'forest' | 'mix' | null
  distance: 'long' | 'middle' | 'sprint' | null
  categories: string[] | RaceCategory[]
  instruction: string[] | RaceInstruction[]
}

export interface RaceCategory {
  amountOfControls: number | null
  date_created: string | null
  date_updated: string | null
  distanceInMeter: number | null
  equidistanceInMeter: number | null
  id: string
  name: string | null
  race: string | Race | null
  sort: number | null
  status: 'published' | 'draft' | 'archived'
  user_created: string | DirectusUser<Schema> | null
  user_updated: string | DirectusUser<Schema> | null
}

export interface RaceInstruction {
  date_created: string | null
  date_updated: string | null
  id: string
  linkCrawled: string | null
  linkOverwritten: string | null
  publicTransportAI: string | null
  race: string | Race
  sort: number | null
  user_created: string | DirectusUser<Schema> | null
  user_updated: string | DirectusUser<Schema> | null
  fileIdAI: string | null
  fileHash: string | null
  summaryAI: string | null
}

export interface UserDeparture {
  date_created: string | null
  date_updated: string | null
  id: string
  race: string | Race | null
  raceCategory: string | RaceCategory | null
  sort: number | null
  startTimeInMinutes: number | null
  status: 'published' | 'draft' | 'archived'
  user: string | DirectusUser<Schema> | null
  user_created: string | DirectusUser<Schema> | null
  user_updated: string | DirectusUser<Schema> | null
}

export interface DirectusSyncIdMap {
  id: number
  table: string
  sync_id: string
  local_id: string
  created_at: string | null
}

export interface CustomDirectusUser {
  birthYear: number | null
  composedIdentifierSolv: string | null
  races: string[] | UserDeparture[]
}

// GeoJSON Types

export interface GeoJSONPoint {
  type: 'Point'
  coordinates: [number, number]
}

export interface GeoJSONLineString {
  type: 'LineString'
  coordinates: Array<[number, number]>
}

export interface GeoJSONPolygon {
  type: 'Polygon'
  coordinates: Array<Array<[number, number]>>
}

export interface GeoJSONMultiPoint {
  type: 'MultiPoint'
  coordinates: Array<[number, number]>
}

export interface GeoJSONMultiLineString {
  type: 'MultiLineString'
  coordinates: Array<Array<[number, number]>>
}

export interface GeoJSONMultiPolygon {
  type: 'MultiPolygon'
  coordinates: Array<Array<Array<[number, number]>>>
}

export interface GeoJSONGeometryCollection {
  type: 'GeometryCollection'
  geometries: Array<
    | GeoJSONPoint
    | GeoJSONLineString
    | GeoJSONPolygon
    | GeoJSONMultiPoint
    | GeoJSONMultiLineString
    | GeoJSONMultiPolygon
  >
}
