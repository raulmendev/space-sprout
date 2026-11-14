# Jardín Comunal

A cozy pixel-art space habitat shared by an astronaut and their family on Earth. It has three zones: a **garden**, a **medical station** and a **social space**. Health check-ins earn seeds, seeds grow plants, and messages are never locked behind anything.

## Quick start

```bash
npm install
npm run dev:web        # http://localhost:4200
```

Requires Node 20+ (tested on Node 24 / npm 11). No environment variables are needed yet.

## Layout

```text
apps/web/                      Angular 22 + Phaser 3.90 + Tailwind 4
  src/app/habitat/             habitat + player stores, canvas host, panels
  src/app/garden/              garden store, persistence gateway, picker, close-up
  src/app/garden/game/         Phaser scene, renderer adapter, asset registry, placeholders
  src/app/npc/                 Sprout's dialogue
  public/assets/game/          final art drops in here (see below)
packages/shared/               domain types, habitat layout, catalog, growth/placement/movement rules
```

Phaser renders and reports interactions (`HabitatInteraction`); it holds no authoritative state. Angular owns state and panels. Game rules live in `@garden/shared` so the API can enforce the same ones.

## The habitat

- One Phaser scene, **24×16 tiles of 32 px (768×512)**. Integer zoom when it fills ≥80% of the space, otherwise fractional; always nearest-neighbour.
- Zones: Garden (11×7, top-left), Medical Station (10×7, top-right), Social Space (22×5, bottom). Tick **Show layout** to see zone boundaries and object footprints.
- Layout, zones and props are data in `packages/shared/src/contracts/habitat.ts`.

## Interaction

The thing you click is the thing you act on. No modes, and no instructions to read.

- **One player (the astronaut) walks the habitat.** Click the floor to walk there. Click an object and the player walks up to it, then it opens (station panel, plant picker or plant close-up). Arrow keys / WASD also move.
- Movement is grid-based (BFS) around walls, soil beds, plants and props. Position is Angular state, and Phaser only animates the steps, so a second (remote) player can be added later as another position.
- Empty plot: a picker with prices. Disabled options say why ("Not enough seeds", "Needs 2×2 free soil").

## Delivering final art (design team)

All art is **placeholder** at the agreed native sizes. To replace an asset:

1. Save the PNG as `apps/web/public/assets/game/<folder>/<key>.png`.
2. Add `<key>` to `apps/web/public/assets/game/manifest.json` → `"delivered"`.

No code changes are needed. Keys, folders, sizes and anchors are defined in `apps/web/src/app/garden/game/asset-registry.ts`. If a listed PNG fails to load, a magenta "?" placeholder shows instead of crashing.

| Asset | Key pattern | Size | Anchor |
|---|---|---|---|
| Tiles | `tile-<kind>` (`tile-grass-0..3`) | 32×32 | top-left |
| Wildflower / Sunflower / Small tree | `plant-<id>-seed\|sprout\|mature` | 32×32; sunflower mature 64×64; tree mature 64×96 (2×2 footprint) | bottom-centre |
| Close-up previews | `preview-<id>-<stage>`, `preview-soil` | 64×64, 80×24 | bottom-centre |
| Medical terminal | `prop-medical-terminal-idle\|syncing\|complete\|attention` | 96×64 (3×2) | bottom-centre |
| Health insights | `prop-health-insights-idle\|new-data\|active` | 96×64 (3×2) | bottom-centre |
| Message board | `prop-message-board-idle\|unread` | 96×64 (3×2) | bottom-centre |
| Emote corner, Earth link | `prop-emote-point`, `prop-comm-terminal` | 64×64 (2×2) | bottom-centre |
| Characters | `player-astronaut`, `npc-sprout` | 32×48 | bottom-centre |

## Status

- [x] Single habitat scene with three zones, placeholder props, footprints and a central asset registry/manifest
- [x] Phaser → Angular interaction events; panel shells for Medical Terminal, Health Insights, Message Board, Emotes
- [x] Garden: plant/grow 3 species (2×2 tree), close-up view, saved to localStorage
- [x] One walking player with click-to-walk and keyboard
- [ ] Layout checkpoint sign-off with the design team
- [ ] NestJS API + Postgres, simulated wearable + measurement entry, insights chart
- [ ] Notes, emotes, family role, Socket.IO sync, second player

## Demo notes

- Growth is sped up for demos (wildflower: sprout at 20s, mature at 1m). See `packages/shared/src/contracts/catalog.ts`.
- "reset demo" restores the seeded garden and player position.
