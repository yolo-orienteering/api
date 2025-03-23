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