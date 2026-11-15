# API

NestJS 12 + TypeORM on Postgres ([Neon](https://neon.tech)). It runs the same game rules as the web app, from `@garden/shared` ([`../shared`](../shared)).

So far it's a skeleton: config, the database connection, migrations, a health check, and one read-only endpoint that proves the shared rules are wired in. Game features come next.

## Run it

```bash
cd api
npm install
cp .env.example .env    # then paste your Neon connection string
npm run start:dev       # http://localhost:3000/api
```

`.env.example` lists every variable with a comment. Only `DATABASE_URL` is required: the API refuses to start without it.

## Endpoints

Everything is under `/api`.

| | |
|---|---|
| `GET /api/health` | Liveness: `200` while the process is up. Doesn't touch the database, so monitors can poll it and Neon still scales to zero. |
| `GET /api/health/db` | Readiness: `200` when the database answers, `503` otherwise. It wakes Neon, so don't poll it. |
| `GET /api/catalog` | The plant catalog and Supply Store items, from `@garden/shared`. |

## Migrations

The schema only changes through migrations (`synchronize` is off).

```bash
cd api
npm run migration:generate -- src/database/migrations/AddHouseholds   # diff the entities against the database
npm run migration:create -- src/database/migrations/SeedSomething      # an empty one, to write by hand
npm run migration:run
npm run migration:revert
```

The API is bundled, so TypeORM can't glob for files. **Register every new entity in `src/database/options.ts` and every new migration in `src/database/migrations/index.ts`.**

The migration commands run TypeScript through `tsx`, which doesn't emit decorator metadata. So **give every `@Column` an explicit type** (`@Column('text')`, `@Column('int')`), or the CLI can't read the entity.

## How it's built

`@garden/shared` (`../shared`, linked with `file:`) is a TypeScript-only package, so `nest build` uses rspack (`rspack.config.cjs`) to compile it into `dist/main.js`. Every other package stays in `node_modules`. Nest 12's packages are ESM-only and load through Node's `require(esm)`, which needs Node 22.12+.

```bash
npm run build
npm run start:prod      # node dist/main.js
npm run typecheck       # tsc only
```
