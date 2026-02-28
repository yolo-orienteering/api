export interface ISolvLinkIdentifier {
  publicationLink: string,
  rankingLink: string,
  inscriptionLink: string[],
  liveResultLink: string,
  departureLink: string
}

export interface ISolvCsv {
  map: string
  club: string
  date: string
  kind: string
  type: string
  region: string
  coord_x: string
  coord_y: string
  deadline: string
  duration: string
  location: string
  national: string
  day_night: string
  unique_id: string
  event_link: string
  event_name: string
  entryportal: string
  last_modification: string
}
