# Handoff: Jardín Comunal (as of 2026-11-14)

## 1. Where things stand

**Repo:** `github.com/raulmendev/astro-garden` (private). The Angular web client lives in `web-app/`; the backend will sit next to it later.

**Branches:**
- `main` (`4f58508`) has everything merged so far: rooms, free movement, the action button, the health loop, and plant care (PR #1).
- **`feat/fullscreen-layout`** (`dfc588c`, pushed) is the latest work. As of writing it has **uncommitted changes**: the popup redesign, the rotate hint and the ⋯ menu fix. Commit and push before branching:
  ```bash
  git add -A web-app && git commit -m "Fit popups to the full-screen view; landscape-only phones" && git push
  ```
  Then either merge it into `main` and branch from `main`, or branch straight from it.
- **The other agent's worktree:** `.claude/worktrees/garden-qa` is on `feat/closeup-layout` (based on `73b4d8f`, the plant-care merge). Its dev server runs on **port 4201**. Don't touch that worktree or its tab.
- Old branches (`feat/rooms`, `feat/health-loop`, `feat/plant-care`, `feat/habitat-movement`, `feat/plant-interaction`) are all merged or abandoned and can be deleted.

**Running it:** `cd web-app && npm install && npm run dev:web`, then open http://localhost:4200.

**Checks used every time:**
- Build: `cd web-app/apps/web && npx ng build --configuration development`
- Unused code: `npx tsc -p tsconfig.app.json --noEmit --noUnusedLocals --noUnusedParameters`

## 2. Architecture

**Code layout:**
```text
web-app/
  packages/shared/src/            ← game rules, pure TS, meant to be reused by the backend
    types/domain.ts               HabitatInteraction, HealthMeasurement, RewardTransaction, Point…
    contracts/habitat.ts          ROOMS (3 rooms, 24×16 tiles each: layout strings, props, doors), NPC_HOME, ROOM_COLS/ROWS
    contracts/rules.ts            placement (footprints, 2×2 tree), isBlocked, objectAtTile
    contracts/movement.ts         walkability (soil IS walkable; plants block), tile BFS, PLAYER_START
    contracts/motion.ts           free movement: canStand, slide (wall slide + corner assist + unstick), string-pulled routes
    contracts/health.ts           METRICS, validateMeasurement, decideReward (3/metric/day, cap 12), MeasurementProvider
    contracts/catalog|growth|care.ts   plants and plant care (care came from the other agent)
  apps/web/src/app/
    app.ts                        full-screen shell; all interactions end up in use() → act()
    habitat/                      HabitatStore (render state, reach, selection, panels), PlayerStore, Ticker (rAF),
                                  hud, touch-pad, action-button, door-labels, layout-overlay, panels/station-dialog|station-panel
    garden/                       GardenStore and GardenService (localStorage `jardin-comunal:garden:v4`),
                                  game/ (Phaser scene, renderer, asset-registry, placeholders, closeup-art), picker, close-up
    health/                       HealthStore and HealthService (localStorage `jardin-comunal:health:v1`), simulated wearable,
                                  terminal/insights panels, trend chart, format.ts (mood shown as 🙂 Good)
    npc/                          dialogue (NpcStore) and wandering (NpcActorStore)
```

**Principles to keep:**
- **Phaser only draws and reports clicks** as `HabitatInteraction`. All state lives in Angular signals.
  - Room content goes through `setState`; characters go through a separate per-frame `setActors` channel.
- **Game rules stay pure and in `packages/shared`,** so the backend can enforce exactly the same ones.
- **Art comes from a central registry** (`asset-registry.ts` plus `public/assets/game/manifest.json` → `delivered`). The design team drops in PNGs without code changes. Placeholders exist at the agreed sizes.
- **The layout fills the screen:**
  - Canvas: `fit()` in `habitat-canvas.component.ts` uses the largest 3:2 size that fits (whole-number zoom if it fills ≥85%).
  - Overlays sit at the screen edges.
  - Popups are a native `<dialog>` (`showModal`, `closedby="any"` plus a Safari fallback), centred on the room view through CSS variables, and sized to it.
  - Layouts inside popups respond to the popup's own width (container queries, e.g. `@lg:` and `@3xl:`).
  - A custom `short:` variant (screens ≤500 px tall) is defined in `styles.css`.
- **Controls:** on-screen pad (bottom-right), A button (bottom-left), WASD/arrows, and E or Space to use whatever is in reach. Tapping an object walks you there and opens it. Floor taps only show info.

## 3. User preferences

- **Language:** reply in **English**. Ignore the handoff specs' "speak Spanish" section.
- **Economy:** coins come **mainly from health habits**; plants pay only a little.
- **Shared space:** astronaut and family share one habitat, so design features to be cooperative.
- **Phones are landscape-only.** Test at 844×390 and 667×375. Portrait shows a "Turn your phone sideways" hint (`.rotate-hint` in `app.ts`).
- **No training:** the thing you tap is the thing you act on, with no modes and no instructions to read.
- **Git:** commit or push only when asked, on feature branches. Merging to `main` has been fast-forward, or a merge commit after merging in `origin/main`.

## 4. Known issues and debt

- **Popups on short screens:** the terminal fits at 844×390 (569×361). Check again whenever content is added. Insights hides its explanation texts on short screens.
- **Not tested on real phones:** notch area, "Add to Home Screen" on iPhone and fullscreen on Android are all unchecked. The manifest has no icons, so Android won't offer to install; the design team should provide 192 and 512 px icons.
- **Fractional zoom on desktop** (e.g. 1.56×) gives slightly uneven pixel sizes. That's accepted for now.
- **All data is browser-only (localStorage),** so there's no real privacy and no sync yet. The family role doesn't exist yet.
- **Message Board and Emotes are placeholder popups.**
- **The other agent's "care ↔ habits" link** was waiting on the health loop. The health loop is on `main` now, so that work is unblocked.

## 5. Testing tips

- **Browser tool:** Playwright MCP, with `browser_run_code_unsafe`. The browser is shared with the other agent's port-4201 tab, so **pick the 4200 tab explicitly**:
  `page.context().pages().find(p => p.url().startsWith('http://localhost:4200'))`.
- **Never force-stop a run in the middle of a mouse action.** It leaves that tab's mouse stuck; open a fresh tab to recover.
- **Finding the player:** decode a canvas screenshot in the page and average the pixels of the visor colour `#2d4f7c`; Sprout's body is `#f5dfb5`. Reading the WebGL buffer directly returns blanks, and whole-screenshot comparisons are noisy because of the pulsing outlines.
- **The screen updates asynchronously** (zoneless Angular), so wait about 200 ms after a click before checking the page.
- **Touch and portrait** need a real mobile context: `browser.newContext({ hasTouch: true, isMobile: true })`.
- **Pure rule checks:** compile shared to the git-ignored `dist/` with `npx tsc packages/shared/src/index.ts --outDir dist/shared-check --module commonjs --target es2022 --skipLibCheck`, run a small `node` script against it, then delete it.

## 6. Suggested next steps (priority order)

1. **Commit and merge `feat/fullscreen-layout`,** after a quick test on a real phone if possible.
2. **Backend skeleton:** `backend/` next to `web-app/`, using NestJS + Postgres via Prisma with Docker Compose.
   - Move `packages/shared` up to the repo root so both apps use it.
   - Swap `GardenService`/`HealthService` for HTTP versions that keep the same method shapes.
   - Run `decideReward` and `validatePlacement` on the server, in transactions, with a unique `measurementId`.
3. **Health privacy on the server:** measurements stay astronaut-only. Family can never read them, and rewards only expose the seed balance.
4. **Social space:** saved notes (280 characters) and emotes, as popups through `StationPanelComponent`.
5. **Second player and family role:**
   - Socket.IO events for garden and social changes.
   - The other person appears as another entry in `HabitatStore.actors`, shown only when you share a room.
   - Throttled position updates.
6. **Demo prep:** seed data, a 2–3 minute script, deployment (Railway + Cloudflare Pages), and app icons.
