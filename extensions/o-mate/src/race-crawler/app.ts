import { defineOperationApp } from '@directus/extensions-sdk'

export default defineOperationApp({
  id: 'race-crawler',
  name: 'Race Crawler',
  icon: 'box',
  description: 'Crawl for orienteering races.',
  overview: ({ text }) => [
    {
      label: 'Text',
      text: text,
    },
  ],
  options: [],
})
