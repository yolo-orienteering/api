# O-Mate API — Directus Backend

## Project Overview

Headless CMS backend for **o-mate**, a Swiss orienteering sports app. Built on **Directus 11.5** with **PostgreSQL 14 + PostGIS**. Provides REST and GraphQL APIs for race management, news aggregation, and game content.

## Tech Stack

- **Runtime:** Node.js 22, TypeScript 5.8
- **CMS:** Directus 11.5.1
- **Database:** PostgreSQL 14 with PostGIS (geographic data)
- **Web Scraping:** Puppeteer, Cheerio
- **AI:** OpenAI API (instruction generation)
- **Schema Sync:** directus-extension-sync (directus-sync)

## Project Structure

```
api/
├── extensions/o-mate/src/    # Custom Directus extensions (TypeScript)
│   ├── instruction-ai/       # OpenAI-powered race instruction generation
│   ├── news-crawler/         # News scraping (SOLV, SRF, Blick, Tamedia, AZ)
│   ├── race-crawler/         # Race event crawler (SOLV federation data)
│   └── types/                # Shared TypeScript interfaces
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

## Custom Extensions

All extensions live in `extensions/o-mate/src/` as Directus operation bundles:

1. **race-crawler** — Scrapes race data from SOLV (Swiss Orienteering Federation). Includes crawlers for races, departures, and instructions. Runs every 15 minutes.
2. **news-crawler** — Scrapes news from Swiss media sources (SOLV, SRF, Blick, Tamedia, Aargauer Zeitung) using Puppeteer. Runs hourly.
3. **instruction-ai** — Generates race instructions via OpenAI GPT. Uploads instruction files for analysis. Runs daily at 01:36.

Each extension has a manual trigger button on its respective Directus collection and a scheduled cron flow.

## Coding Conventions

- Write all extension code in **TypeScript**
- Extension source goes in `extensions/o-mate/src/`, never modify files in `dist/`
- Follow the existing crawler pattern: extend the `Crawler` base class in `race-crawler/Crawler.ts`
- Use Directus SDK services for database operations within extensions
- Shared types belong in `extensions/o-mate/src/types/DirectusTypes.ts`
- Schema changes must be exported via `npm run schema:dump` after modification
- Never commit `.env` files — use `.env.example` as template
- The Directus admin runs on port **8055**

## Environment Variables

Key variables (see `.env.example` for full list):
- `DB_*` — PostgreSQL connection settings
- `ADMIN_EMAIL` / `ADMIN_PASSWORD` — Initial admin credentials
- `OPEN_AI_KEY` — OpenAI API key for instruction-ai extension
- `DIRECTUS_SYNC_TOKEN` — Token for schema synchronization
