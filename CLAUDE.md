# O-Mate API — Directus Backend

## Project Overview

Headless CMS backend for **o-mate**, a Swiss orienteering sports app. Built on **Directus 11.5** with **PostgreSQL 14 + PostGIS**. Provides REST and GraphQL APIs for race management, news aggregation, game content, and iCalendar subscriptions. See the [root CLAUDE.md](../CLAUDE.md) for the overall multi-project architecture.

## Tech Stack

- **Runtime:** Node.js 22 (22.14), TypeScript 5.8
- **CMS:** Directus 11.5.1
- **Database:** PostgreSQL 14 with PostGIS 3.3 (geographic data)
- **Web Scraping:** Puppeteer, Cheerio
- **AI:** OpenAI SDK (instruction generation) — lives in `extensions/o-mate/package.json`, not the root
- **Schema Sync:** directus-extension-sync (directus-sync)
- **Other notable libs:** date-fns, swiss-projection (WGS84 ↔ Swiss coords), csvjson

## Project Structure

```
api/
├── extensions/o-mate/src/    # Custom Directus extensions (TypeScript)
│   ├── instruction-ai/       # OpenAI-powered race instruction generation (operation)
│   ├── news-crawler/         # News scraping, adapter-per-source (operation)
│   ├── race-crawler/         # Race event crawler — SOLV data (operation)
│   ├── calendar-subscription/ # Custom endpoint: ICS calendar export + Turnstile
│   └── types/                # Shared TypeScript interfaces (DirectusTypes.ts)
├── schema/                   # Directus schema definitions (directus-sync)
│   ├── collections/          # Collection configs
│   ├── snapshot/             # Schema snapshots (collections, fields, relations)
│   └── specs/                # OpenAPI & GraphQL specs
├── uploads/                  # Local file storage
├── docker-compose.yaml       # PostgreSQL + PostGIS container
├── Dockerfile                # Production container image
└── directus-sync.config.js   # Schema sync configuration
```

## Key Commands

```bash
npm run dev               # Start Docker DB + Directus
npm run setup             # First-time setup (copy .env, install deps)
npm run schema:dump       # Pull schema from running Directus instance
npm run schema:load       # Push schema to running Directus instance
npm run database:migrate  # Run pending database migrations
```

Extension development:
```bash
cd extensions/o-mate
npm run dev       # Watch mode
npm run build     # Production build
```

## Database Collections

| Collection | Purpose |
|---|---|
| Race | Orienteering race events (name, city, country, date, distance, terrain) |
| RaceCategory | Categories within races (distance, controls) |
| RaceInstruction | Instructions for races (text, links, images) |
| UserDeparture | User departure entries in races |
| Post | News/forum posts (user-post, news-post, forum-post) |
| PostMedia | Media attachments (images, YouTube) |
| Game | Training games/activities |
| GameAuthor | Game authors/sources |
| GameCategory | Game categories with icons |
| GameVariant | Game variants with external URLs |
| GameCategory junction | `Game_GameCategory` M2M join |
| CalendarSubscription | User iCalendar subscription (links followed races) |
| CalendarSubscription_Race | M2M junction: subscription ↔ races |

## Custom Extensions

All extensions live in `extensions/o-mate/src/`. The three crawlers are Directus
**operations** wired into scheduled flows (see `schema/collections/flows.json`);
calendar-subscription is a custom **endpoint**.

1. **race-crawler** — Scrapes race data from SOLV (Swiss Orienteering Federation): races,
   departures, and instructions. Crawlers extend a shared `Crawler` base class.
   Scheduled `0 */15 * * * *` (every 15 minutes).
2. **news-crawler** — Scrapes news from Swiss media using Puppeteer, one
   `NewsSiteAdapter` subclass per source: SOLV, SOLV forum, SRF, Blick, Tamedia,
   Aargauer Zeitung. Scheduled `0 0 * * * *` (daily at midnight UTC).
3. **instruction-ai** — Generates race instructions via the OpenAI SDK; uploads
   instruction files for analysis. Scheduled `0 36 1 * * *` (daily at 01:36 UTC).
4. **calendar-subscription** — Custom endpoint (not a scheduled operation):
   - `POST /calendar-subscription` — create a subscription; verifies a Cloudflare
     **Turnstile** token before persisting.
   - `GET /calendar-subscription/:id/calendar.ics` — RFC 5545 ICS feed of the
     subscription's races (timezone `Europe/Zurich`, validates race GeoJSON coords).

Each crawler also has a manual trigger button on its respective Directus collection.

## Coding Conventions

- Write all extension code in **TypeScript**
- Extension source goes in `extensions/o-mate/src/`, never modify files in `dist/`
- Follow the existing crawler pattern: extend the `Crawler` base class in `race-crawler/classes/crawler/Crawler.ts`; for news, add a `NewsSiteAdapter` subclass under `news-crawler/src/news-sites/`
- Use Directus SDK services for database operations within extensions
- Shared types belong in `extensions/o-mate/src/types/DirectusTypes.ts`
- Schema changes must be exported via `npm run schema:dump` after modification
- Never commit `.env` files — use `.env.example` as template
- The Directus admin runs on port **8055**

## Keeping this doc current

When you make a code change that affects anything described here — stack/deps, collections,
extensions, endpoints, crawler schedules, env vars, commands, or conventions — **update this
`CLAUDE.md` as part of the same change.** See [root CLAUDE.md](../CLAUDE.md) for the full policy.

## Environment Variables

Key variables (see `.env.example` for full list):
- `DB_*` — PostgreSQL connection settings
- `ADMIN_EMAIL` / `ADMIN_PASSWORD` — Initial admin credentials
- `OPEN_AI_KEY` — OpenAI API key for instruction-ai extension
- `DIRECTUS_SYNC_TOKEN` — Token for schema synchronization
- `TURNSTILE_SECRET_KEY` — Cloudflare Turnstile secret for the calendar-subscription endpoint
- `FRONTEND_URL` — used when generating ICS calendar links
