import { defineHook } from '@directus/extensions-sdk'

export default defineHook(({ schedule }) => {
	schedule('0 */15 * * * *', async () => {
		console.log('Hallo Crawler')
	})
})
