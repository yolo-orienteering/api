## Develop locally
To make schema changes, you have to develop locally, update the schema and deploy it.

## Get started
- Initialize repository run: `npm run setup`
- Start local postgres database run: `npm run db:start`
- Initialize directus run: `npm run directus:init`
- Start directus: `npm run directus:start`
- Log-in into Directus, create api-token for an Admin User and add it in the `.env` file at `DIRECTUS_TOKEN` variable
- `npm run schema:load`

## Dev Credentials:
URL: http://localhost:8055  
Username: admin@seccom.ch
Password: admin

## Save made changes
To synchronize settings and schema among environments we use [directus-sync](https://tractr.github.io/directus-sync/)
- Store new schema run: `npm run schema:dump`
- Push changes to git.

## Dump staging database and restore it locally (seeding)
- Follow all the steps in [Get started](#get-started)
- Stop the local database and directus
- Create a connection to the remote staging database with oc login and forward the port.
- run `pg_dump -U postgres -W -h localhost -Fc -d scool-staging > ./directus.dump`
- Cut the connection to the remote staging database.
- `npm run db:start`
- run `pg_restore -U postgres -w -W -d directus -h localhost --clean ./directus.dump`
- start directus
- run `npm run schema:dump` and `git diff`and make sure, there are no unwanted changes.