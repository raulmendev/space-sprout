# API

NestJS 12 + TypeORM on Postgres ([Neon](https://neon.tech)). It runs the same game rules as the web app, from `@garden/shared` ([`../shared`](../shared)).

So far: config, the database connection, migrations, a health check, the catalog, **stations (households), members and sessions** behind the web app's start menu, **each station's shared garden** (seeds, inventory, plants, decorations, notes), changed only by commands, **each member's private health record** (check-ins pay their seeds in the same transaction), and a **live channel** that sends every change and everyone's position to the rest of the station as it happens.

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
| `POST /api/join` | The start menu: `{ displayName, role, suit, stationKey? }`. No key starts a new station; a key (any case, dashes ignored) joins that one. Creates the member and returns `{ token, expiresAt, member, stationKey }`. |
| `GET /api/stations/:key/members` | Who's already in the station a key names, for the start menu's "Already aboard?". `404` for an unknown key. |
| `POST /api/session` | "That's me": `{ stationKey, memberId }` signs in as someone already in that station, on a new device. Returns the same shape as `/join`. |
| `GET /api/session` 🔒 | Who you are, your station's key and everyone in it: what the game loads at boot. |
| `DELETE /api/session` 🔒 | Sign this device out. |
| `PATCH /api/members/me` 🔒 | Change your `displayName`, `role`, `suit` or `color`. |
| `GET /api/garden` 🔒 | The station's shared state (garden, seeds, inventory, purchases, decorations, notes), its `version` and the server's clock. The first visit plants the starting garden. |
| `POST /api/garden/commands` 🔒 | `{ id, command }`: one change, e.g. `{ "type": "PLANT", "itemType": "lettuce", "x": 2, "y": 9 }`. The shared rules (`runCommand` in `@garden/shared`) decide; the answer is `{ ok, result \| error, version, state }`, always with the latest state. The station's row is locked while a command runs, and a repeated `id` gets the stored answer instead of running again. |

**Live channel:** a WebSocket at `/api/live` (same port). The client's first message is `{ "type": "AUTH", "token": "…" }` (browsers can't set headers on a WebSocket, and a token in the URL would end up in logs); the server answers `READY`, or `DENIED` and closes with 4401. After every change to a station's garden, everyone connected to that station gets `{ "type": "GARDEN", version, state, serverTime, by, command }`: the whole state, so a missed message can't leave anyone behind (clients ignore versions older than what they show). Broadcasts live in memory, which is right for one API instance; running more would need a shared channel such as Redis. Message shapes: `shared/src/contracts/live.ts`.

🔒 needs `Authorization: Bearer <token>`. The session guard is global: every new route needs a session unless it's marked `@Public()`. Tokens last 30 days and only their SHA-256 is stored. There is no password yet: anyone with a station key can join that station. Bodies are validated with Zod (`@Body({ schema })`, Nest's `StandardSchemaValidationPipe`).

The demo station, seeded by a migration, has the key **`GARDEN`** and the members `astronaut-demo` and `family-demo` (the web app's old demo ids).

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

The migration commands run TypeScript through `tsx`, which doesn't emit decorator metadata. So **give every `@Column` an explicit type** (`@Column('text')`, `@Column('int')`), or the CLI can't read the entity. And wrap relation properties in `Relation<>` (`household!: Relation<HouseholdEntity>`): in the bundle, two entities that point at each other otherwise crash at startup ("Cannot access … before initialization").

## How it's built

`@garden/shared` (`../shared`, linked with `file:`) is a TypeScript-only package, so `nest build` uses rspack (`rspack.config.cjs`) to compile it into `dist/main.js`. Every other package stays in `node_modules`. Nest 12's packages are ESM-only and load through Node's `require(esm)`, which needs Node 22.12+.

```bash
npm run build
npm run start:prod      # node dist/main.js
npm run typecheck       # tsc only
```

## Deploy (Railway)

The API runs on Railway as the `api` service of the **astro-garden** project (production: `https://api-production-77840255.up.railway.app/api`), in `us-west2` next to the Neon database.

- **Build:** `api/Dockerfile`, from the repo root (it compiles `../shared` into the bundle). `.dockerignore` keeps `web-app/`, `node_modules`, `dist` and `.env` files out of the image.
- **Settings as code:** `.railway/railway.ts` (builder, Dockerfile path, health check on `/api/health`, region, which paths trigger a deploy). Preview with `railway config plan`, apply with `railway config apply` (run `npm install` in `.railway/` first).
- **Variables live in Railway, not in the repo:** `DATABASE_URL` (Neon's pooled URL). Set `CORS_ORIGINS` to the web app's URL once it's deployed; until then only local origins can call the API from a browser. `PORT` is Railway's.
- **Migrations** don't run on deploy. Run them from your machine as before (`npm run migration:run`, direct URL); local and production share the one Neon database for now.
