import { defineOperationApp } from '@directus/extensions-sdk'

export default defineOperationApp({
	id: 'o-mate-news-crawler',
	name: 'News Crawler',
	icon: 'box',
	description: 'Crawling for news for users feed',
	overview: ({ text }) => [
		{
			label: 'Text',
			text: text,
		},
	],
	options: [],
})
