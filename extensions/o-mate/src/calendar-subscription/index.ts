import { defineEndpoint } from '@directus/extensions-sdk'
import type { Item } from '@directus/types'
import type {
  Schema,
  Race,
  CalendarSubscription,
  CalendarSubscriptionRace,
} from '../types/DirectusTypes'
import type { ItemsService } from '@directus/api/dist/services/items'

type TableName = keyof Schema

export default defineEndpoint((router, { services, getSchema, env }) => {
  function createItemsService<T extends Item>(
    tableName: TableName,
    schema: any,
  ): ItemsService<T> {
    return new services.ItemsService(tableName, { schema })
  }

  async function verifyTurnstile(token: string): Promise<boolean> {
    const secretKey = env['TURNSTILE_SECRET_KEY']
    if (!secretKey) {
      throw new Error(`Env variable 'TURNSTILE_SECRET_KEY' not set!`)
    }

    const response = await fetch(
      'https://challenges.cloudflare.com/turnstile/v0/siteverify',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          secret: secretKey,
          response: token,
        }),
      },
    )

    const data = (await response.json()) as { success: boolean }
    return data.success
  }

  function escapeIcsText(text: string): string {
    return text
      .replace(/\\/g, '\\\\')
      .replace(/;/g, '\\;')
      .replace(/,/g, '\\,')
      .replace(/\n/g, '\\n')
  }

  function formatIcsDate(dateStr: string | number | Date): string {
    const date = new Date(dateStr)
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}${month}${day}`
  }

  function nextDay(dateStr: string): Date {
    const date = new Date(dateStr)
    date.setDate(date.getDate() + 1)
    return date
  }

  function getRaceUrl(race: Race): string {
    const frontendUrl = env['FRONTEND_URL']
    if (!frontendUrl) {
      throw new Error(`env variable 'FRONTEND_URL' missing.`)
    }
    return `${frontendUrl}/races/${race.id}`
  }

  function generateIcs(races: Race[]): string {
    const now = new Date()
    const timestamp = now
      .toISOString()
      .replace(/[-:]/g, '')
      .replace(/\.\d{3}/, '')

    let ics = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//o-mate calendar',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'X-WR-CALNAME:o-mate',
      'X-WR-TIMEZONE:Europe/Zurich',
    ].join('\r\n')

    for (const race of races) {
      if (!race.date) continue

      const summary = escapeIcsText(race.name || 'OL')
      const location = escapeIcsText(
        [race.city, race.region, race.country].filter(Boolean).join(', '),
      )

      const dtStart = formatIcsDate(race.date)
      const dtEnd = formatIcsDate(nextDay(race.date))
      const lastModified = formatIcsDate(race.date_updated!)
      const coordinates =
        race.coordinates?.coordinates.length === 2 &&
        race.coordinates.type === 'Point'
          ? `${race.coordinates.coordinates[1]};${race.coordinates.coordinates[0]}`
          : null

      ics +=
        '\r\n' +
        [
          'BEGIN:VEVENT',
          `UID:${race.id}@o-mate.app`,
          `DTSTAMP:${timestamp}`,
          `DTSTART;VALUE=DATE:${dtStart}`,
          `DTEND;VALUE=DATE:${dtEnd}`,
          `LAST-MODIFIED:${lastModified}`,
          `SUMMARY:${summary}`,
          location ? `LOCATION:${location}` : null,
          `URL:${getRaceUrl(race)}`,
          coordinates ? `GEO:${coordinates}` : null,
          'END:VEVENT',
        ]
          .filter(Boolean)
          .join('\r\n')
    }

    ics += '\r\nEND:VCALENDAR\r\n'
    return ics
  }

  // POST / — Create a new calendar subscription (requires Turnstile)
  router.post('/', async (req, res) => {
    try {
      const { turnstileToken, races } = req.body as {
        turnstileToken: string
        races: string[]
      }

      if (!turnstileToken) {
        res.status(400).json({ error: 'Turnstile token is required' })
        return
      }

      if (!Array.isArray(races)) {
        res.status(400).json({ error: 'races must be an array of race IDs' })
        return
      }

      const valid = await verifyTurnstile(turnstileToken)
      if (!valid) {
        res.status(403).json({ error: 'Turnstile verification failed' })
        return
      }

      const schema = await getSchema()
      const subscriptionService = createItemsService<CalendarSubscription>(
        'CalendarSubscription',
        schema,
      )

      // Create subscription with M2M race relations
      const id = await subscriptionService.createOne({
        races: races.map((raceId) => ({
          Race_id: raceId,
        })) as any,
      })

      res.json({ id })
    } catch (error) {
      console.error('calendar-subscription POST error:', error)
      res.status(500).json({ error: 'Internal server error' })
    }
  })

  // GET /:id/calendar.ics — Serve the ICS file
  router.get('/:id/calendar.ics', async (req, res) => {
    try {
      const { id } = req.params

      const schema = await getSchema()
      const subscriptionService = createItemsService<CalendarSubscription>(
        'CalendarSubscription',
        schema,
      )

      let subscription: CalendarSubscription
      try {
        subscription = (await subscriptionService.readOne(id, {
          fields: ['id', 'races.Race_id.*'],
        })) as CalendarSubscription
      } catch {
        res.status(404).json({ error: 'Subscription not found' })
        return
      }

      const subscriptionRaces =
        (subscription.races as CalendarSubscriptionRace[]) || []
      const races = subscriptionRaces.map(
        (subscriptionRace) => subscriptionRace.Race_id as Race,
      )

      res.setHeader('Content-Type', 'text/calendar; charset=utf-8')
      res.setHeader('Content-Disposition', 'attachment; filename="o-mate.ics"')
      res.send(generateIcs(races))
    } catch (error) {
      console.error('calendar-subscription GET ics error:', error)
      res.status(500).json({ error: 'Internal server error' })
    }
  })
})
