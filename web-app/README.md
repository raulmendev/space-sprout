# Jardín Comunal

A cozy pixel-art space habitat shared by an astronaut and their family on Earth. It has three zones: a **garden**, a **medical station** and a **social space**. Health check-ins earn seeds, seeds grow plants, and messages are never locked behind anything.

## Quick start

```bash
cd web-app
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

- **Three rooms, one per zone, each a full 24×16-tile screen (768×512).** Only the room you're in is rendered. Rooms connect through labelled doors in their side walls: **Garden ← Social Space → Medical Station**. Players start in the Social Space hub.
- One Phaser scene; changing rooms rebuilds it behind a short fade. Integer zoom when it fills ≥80% of the space, otherwise fractional; always nearest-neighbour.
- The Garden has two large walkable soil fields (180 plots) around a centre path; plants block their own footprint. Tick **Show layout** to see the active room's object footprints and doors.
- Rooms (layout, props, doors) are data in `packages/shared/src/contracts/habitat.ts`. A position anywhere in the habitat is `{ room, x, y }`.

## Interaction

The thing you tap is the thing you act on. No modes, and no instructions to read.

- **Move with the on-screen pad or WASD / arrow keys.** The pad sits bottom-right at low opacity: press and drag in any direction (built for phones; works with a mouse). Movement is free, not tile-by-tile, at the same speed in every direction (diagonals are normalised). Characters slide along walls, and corner assist eases you into doorways and gaps you're slightly off from.
- **Use what's in reach with the action button (A), E or Space.** The nearest usable thing within ~1.5 tiles (station, plant, free plot, Sprout) gets a soft green outline, and the label above the button says what it'll do ("Open Medical Terminal", "Plant here", "Talk to Sprout").
- **Or tap an object directly:** the player walks up to it on a smoothed route, then it opens (station panel, plant picker or plant close-up). Tapping plain floor only shows what it is.
- **Walk onto a door** to go to the next room. Leaving a room closes its panels, picker and close-up.
- **Sprout** strolls around near its spot in the Garden, and stops when you come to talk.
- Positions are continuous `{ room, x, y }` points in Angular state, stepped by one shared animation-frame ticker; Phaser only draws them (characters go through a separate per-frame "actors" channel, so the room isn't rebuilt every frame). A second, remote player later is just another position, shown when it's in your room.
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
- [x] One player with free movement: on-screen pad + action button + keyboard, or tap objects to walk up and use them
- [x] Habitat split into three single-screen rooms joined by doors
- [ ] Layout checkpoint sign-off with the design team
- [ ] NestJS API + Postgres, simulated wearable + measurement entry, insights chart
- [ ] Notes, emotes, family role, Socket.IO sync, second player

## Demo notes

- Growth is sped up for demos (wildflower: sprout at 20s, mature at 1m). See `packages/shared/src/contracts/catalog.ts`.
- "reset demo" restores the seeded garden and player position.
