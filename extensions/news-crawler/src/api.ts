import { defineOperationApi } from '@directus/extensions-sdk'
import NewsCrawler from './NewsCrawler'

type Options = []

export default defineOperationApi<Options>({
	id: 'o-mate-news-crawler',
	handler: async (_options, { }) => {
		await new NewsCrawler().crawl()
	},
})
