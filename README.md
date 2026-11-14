# Jardín Comunal

A shared pixel-art garden for astronauts and their families. Health check-ins earn seeds, and seeds grow plants. Family messages are never locked behind anything.

## Quick start

```bash
npm install
npm run dev:web        # http://localhost:4200
```

Requires Node 20+ (tested on Node 24 / npm 11). No environment variables are needed yet.

## Layout

```text
apps/web/            Angular 22 + Phaser 3.90 + Tailwind 4
  src/app/garden/    store (signals), persistence gateway, components
  src/app/garden/game/  Phaser scene, tile manager, sprites (rendering only)
  src/app/npc/       Sprout's dialogue data + controller
packages/shared/     Domain types, catalog, growth + placement rules (shared with the future API)
```

Rule of thumb: **Phaser renders and reports clicks, and decides nothing.** Angular owns the UI state. Game rules live in `@garden/shared` so the NestJS API can enforce the same ones.

## Status

- [x] **Milestone 1**: playable garden. A 12×12 tile grid with tile selection, 3 plants with timestamp-based growth (seed → sprout → mature) and a Sprout NPC with dialogue. The garden is saved to localStorage.
- [ ] Phase 2: NestJS API + Postgres (Prisma). `GardenService` gets swapped for an HTTP implementation.
- [ ] Phase 3: health check-ins (simulated provider) with server-side rewards that can't be duplicated.
- [ ] Phase 4: family role, Socket.IO sync, messages.

## Interaction principle: no training required

The thing you click is the thing you act on. Hovering an empty plot shows a "+". Clicking it opens a small picker right there with prices. Clicking a plant shows its info, and clicking Sprout starts a conversation. There are no modes, tools or instructions to read.

## Demo notes

- Growth is sped up for demos (flower: sprout at 20s, mature at 1m). See `packages/shared/src/contracts/catalog.ts`.
- "reset demo" in the header restores the seeded garden.
- All sprites are original and defined in code (`plant-sprites.ts`), so no asset licensing concerns.
