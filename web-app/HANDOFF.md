# Handoff: Jardín Comunal (as of 2026-11-15, night)

## 1. Where things stand (read this first)

**Repo:** `github.com/raulmendev/astro-garden` (private). The Angular web client lives in `web-app/`; a backend will sit next to it later. Other people (Raúl Méndez) also merge PRs into `main`, so **always `git fetch` before starting**.

**Branch state right now:**
- `origin/main` = `9993959` (PR #9, "Place decorations in the Social Space from the inventory", by Raúl).
- Local `main` = `d0503f8`, **2 commits behind** `origin/main` and with **uncommitted work** (the astronaut, §4). Nothing local is unpushed apart from that work.
- **Next step before anything else:** commit the astronaut work (§4), then `git merge origin/main`. Expect conflicts in two files PR #9 also touched:
  - `apps/web/src/app/garden/game/habitat.scene.ts`: PR #9 adds decorations; ours adds `ActorAnim`, `update()`/`showFrame()`, `lastActors`.
  - `apps/web/src/app/habitat/habitat.store.ts`: PR #9 adds decorations to the render state; ours adds `playerAnim` and the player actor's `anim`.
  - `app.ts` and `asset-registry.ts` are also changed on both sides but probably merge cleanly. Keep both sides everywhere.
  - After merging: run the build and type check (below), then check walking, standing poses, wave, and decorations in a browser.
- **Uncommitted on purpose:** `apps/web/angular.json` (`"analytics": false`, a personal Angular CLI setting). Never commit it.
- Merged PRs so far: #1–#5 (plant care, close-up, full-screen layout, terminal look, station crew), #6 Supply Store, #7 inventory, #8 message board + Health Insights goals/streaks, #9 decorations. Old `feat/*` branches are merged and can be deleted.

**This clone:** `C:\Users\jesus\Desktop\Astro Garden\astro-garden` (Windows). The remote is SSH; the key is in `C:\Users\jesus\.ssh`. Git has **no user configured** on this PC: commit with `git -c user.name=chucordova -c user.email=jesusremedios.cordova@gmail.com commit …`.

**Running it:** `cd web-app && npm install && npm.cmd run dev:web` → http://localhost:4200.
- PowerShell blocks `npm.ps1`: use `npm.cmd`, or once `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`.
- The user usually keeps their own server on **4200**. Claude's preview server runs on **4201** (config in `C:\Users\jesus\Desktop\Astro Garden\.claude\launch.json`, outside the repo).
- **`ng serve` can get stuck** after a compile error during a merge: it keeps serving the last good bundle. Symptom: the user "doesn't see" new features. Check with `curl -s http://localhost:4200/main.js | grep -c <something new>`; fix by restarting the server, then `Ctrl+F5` in the browser.

**Checks used every time:**
- Build: `cd web-app/apps/web && npx ng build --configuration development`
- Unused code: `npx tsc -p tsconfig.app.json --noEmit --noUnusedLocals --noUnusedParameters`. One known, harmless hit: an unused `action` parameter in `plant-closeup.component.ts` (`hint()`).
- No leftover merge markers: `grep -rln "^<<<<<<<" apps packages --include=*.ts`.

## 2. Architecture

```text
web-app/
  packages/shared/src/            ← game rules, pure TS, reused by the future backend
    types/domain.ts               HealthMetric (10), CrewId, RewardTransaction (+reason), HabitatInteraction…
    contracts/habitat.ts          ROOMS (Garden / Social / Medical, 24×16 tiles), props
    contracts/rules|movement|motion.ts   placement, walkability, free movement
    contracts/health.ts           METRICS, METRIC_ORDER (terminal 6), ALL_METRICS (10), decideReward(…, worth)
    contracts/checkin.ts          answer bands per reading → seeds x1–x4 and the crew's reply   (this session)
    contracts/crew.ts             CREW: who asks about what; `scans` for the scientist
    contracts/insights|goals.ts   usual ranges, goals, streak bonuses (PR #8)
    contracts/store|notes|decor.ts  Supply Store, post-it notes, decorations (PRs #6–#9)
    contracts/catalog|growth|care.ts  plants
  apps/web/src/app/
    app.ts                        shell; interactions → use() → act(); wave-on-conversation effect
    habitat/                      HabitatStore (render state, actors), PlayerStore (movement, facing, wave), hud, pad
    garden/                       GardenStore/Service (localStorage `jardin-comunal:garden:v8`), game/ (Phaser)
    health/                       HealthStore/Service (`jardin-comunal:health:v1`), terminal, insights, wearable sim
    npc/                          crew-lines.ts (all dialogue text), crew-reminders.ts (flow), bubble
    social/ store/                message board, Supply Store, inventory
```

**Principles to keep:**
- **Phaser only draws and reports clicks.** All state lives in Angular signals. The scene gets `setState` (room) and `setActors` (characters, every frame while moving).
- **Rules are pure and live in `packages/shared`,** so the server can run exactly the same ones (`decideReward`, `rewardFor`, `validatePlacement`).
- **Art goes through `asset-registry.ts` + `public/assets/game/manifest.json` → `delivered`.** A PNG not listed falls back to a placeholder.
- **Layout:** full-screen 3:2 canvas, popups as `<dialog>` with fixed height, `short:` variant (height ≤ 500 px). Phones are landscape-only: test at **844×390** and **667×375**.
- **Language:** in-game text and code in English; chat with the user in Spanish.

## 3. Crew check-ins (this session, pushed)

The user wrote a dialogue script (sleep, temperature, heart rate, exercise, stress, diet, radiation/CO₂) with a multiplier per answer. It became:

**Who asks what** (`contracts/crew.ts`):
| Crew | Readings | How |
|---|---|---|
| Dr. Mira (Medic) | MOOD, SLEEP (h), BODY_TEMP (°C), HEART_RATE (bpm) | number; "Don't know" for temperature and heart rate |
| Coach Tao (Trainer) | ACTIVITY (min), STRESS (1–5 buttons) | number; stress buttons Low / Moderate / Optimal / High / Too high |
| Chef Rosa (Chef) | CALORIES (kcal), WATER (L) | number |
| Dr. Okafor (Scientist) | RADIATION, CO2 (ppm) | 📡 Scan button: reads both (simulated), "Beep… beep… beep…" |

**Bands and seeds** (`contracts/checkin.ts`, all in one table):
- "xN" means **N seeds**. x3 equals the old flat 3 seeds per reading.
- Numbers stay numbers in the record; bands are only how the crew read them back.
- Sleep: <5 h x1, 5–6.5 x2, 6.5–7.5 x3, 7.5–9.5 x4, >9.5 x3.
- Body temperature: 36.1–37.2 °C x3, near it x2, otherwise x1, "Don't know" x1.
- Heart rate: 50–100 x3, otherwise x1, "Don't know" x1.
- Activity: ≥30 min x3, 1–29 x2, 0 x1.
- Stress: Low/Moderate/Optimal x3, High x2, Too high x1.
- Calories: 2300–2700 x3, otherwise x2.
- Water: <3.5 L x3, 3.5–4 x4, >4 x2. (These are the user's numbers.)
- Mood: always x3, never judged.
- Radiation and CO₂: always x2. The user's script said "x for each"; Claude chose x2 because the astronaut doesn't control the environment. **Not confirmed with the user.**
- Daily cap raised 18 → **30** (= a perfect day). PR #8's goal/streak bonuses are paid on top and don't count toward it.
- **Not confirmed with the user:** the bands Claude invented (temperature, heart rate, the ±200 kcal margin) and the cap.

**Dialogue** (`npc/crew-lines.ts`): every line has 2–3 variants per character. There's an intro on the first question of the day, a reply per band, and a goodbye. The English was polished from the user's script (e.g. "No! Keep it right there" → "Nice! Keep it right there").
- **"Later" or ✕ on a crew question:** the character says goodbye and reminds you to finish at the **Medical Station** (`LATER` lines). The order of who asks first doesn't matter (user's call).
- "Don't know" is stored as such (`unknowns` in the health snapshot), never as a fake number. It pays once per metric per day, and the terminal shows it as "? Don't know".

**Medical terminal:**
- The checklist shows all 10 readings and scrolls inside its own card.
- "Enter manually" has **one tab per crew member** (Medic / Trainer / Chef / Science), with a dot on tabs holding unsaved values.
- Everything fits at 844×390 without the terminal scrolling.

**Verified:** in the user's Chrome (Claude in Chrome extension), every conversation, the scan, Later/✕, the terminal tabs, and saving from the terminal (+9 banded seeds plus a streak bonus).

## 4. New astronaut (this session, **uncommitted**)

**Source art** (in `C:\Users\jesus\Downloads`):
- `Jardin_Comunal_Astronauta_Turquesa_22_Sprites.zip`: walk 4 directions × 4 frames, wave × 6.
- `Jardin_Comunal_Astronauta_Celeste_4_Posiciones_Parado.zip`: standing pose × 4 directions.

**Pipeline:** `herramientas-arte/process_astronaut.py <characters dir> <preview.png|-> <unzipped folders…>`
- It removes the source sheet's cell borders: the walk frames had a dark rounded line on the right and bottom, the right-facing ones a vertical line, and wave 5–6 had crumbs.
- One crop window and scale for every frame (36×50 px in game). Each animation's feet are aligned to the same line, since the wave was drawn 7 px lower.
- Pillow isn't installed in this PC's Python; Claude used a throwaway venv in its scratchpad. Reinstall with `python -m venv <dir> && <dir>/Scripts/python -m pip install pillow numpy`.

**Files:** `public/assets/game/characters/player-astronaut-{down,up,left,right}-{1..4}.png`, `-{dir}-idle.png`, `-wave-{1..6}.png` (26 PNGs, all listed in `manifest.json`).

**Code:**
- `asset-registry.ts` → `PLAYER_FRAMES = { walk, idle, wave }`, `Facing`; `PLAYER_TEXTURE` = the front-facing standing pose.
- `player.store.ts` → `facing` (4 directions, with hysteresis so diagonals don't flicker), `wave()` / `waveAt`, `WAVE_MS = 1400`.
- `habitat.store.ts` → `playerAnim`: walking = 4 frames at 8 fps; still = that direction's idle pose; waving = the wave twice.
- `habitat.scene.ts` → `RenderActor.anim` (`ActorAnim`). The scene advances frames in its own `update()`, so it animates while signals are quiet. Animated actors aren't flipped or bobbed. Crew NPCs are unchanged.
- `app.ts` → the astronaut waves whenever a conversation starts (Sprout or crew). The wave is skipped with reduced motion.
- Fix: `setActors` received during a room fade was dropped, and standing still sends nothing new, so the walk frame could freeze. The scene now keeps `lastActors` and redraws them after `enterRoom`.

**Open issue:** the user reported the astronaut **staying mid-stride when stopped**. In Claude's tests (keys, the joystick dragged with the mouse, and stopping during a room change, on both 4200 and 4201) it shows the standing pose. The room-change bug above was found and fixed. The user hasn't confirmed yet:
- If it still happens, ask how they move (keyboard / joystick / tapping the map) and in which room.
- Then reproduce exactly that.
- Also rule out a stale tab (`Ctrl+F5`).

## 5. Other work this session (all pushed)

- **Plant picker** places itself on screen (above or below the plot, clamped under the HUD) and uses 7 columns on short screens. **Plant close-up** has a compact short-screen mode. Both verified at 844×390 and 667×375.
- Merges with PR #6/#7 (store, inventory: picker shows "× n" packets; the garden seed keeps the store's balance 20 + starter inventory; storage key **v8**) and PR #8 (Health Insights over all 10 readings).

## 6. User preferences

- **Chat in Spanish**; game text and code in English.
- **Commits:** `chucordova <jesusremedios.cordova@gmail.com>`. Commit or push **only when asked**. The user likes pushing straight to `main`, after checking for conflicts with `origin/main`.
- The user wants to **watch the testing**: use **Claude in Chrome** (the extension is installed and connected); the app's own browser pane is often hidden. Reply with what was tested and what wasn't.
- Windows line endings: the working tree is CRLF. Keep each file's existing endings when editing.
- From the original owner (still valid):
  - Seeds come mainly from health habits.
  - The habitat is shared with family, so features should be cooperative.
  - Phones are landscape-only.
  - The thing you tap is the thing you act on.

## 7. Testing tips

- **Browser automation:** the dev build exposes `ng.getComponent(document.querySelector('app-root'))` → `app.player`, `app.habitat`, `app.crewReminders`, `app.onInteraction({type:'NPC_SELECTED', npcId:'CHEF'})` (the same path as a tap).
- **Moving:** dispatch `KeyboardEvent`s on `document.body`, not `document` (the handler calls `target.closest`). Blur focused buttons first, because the room tabs (`role="tablist"`) swallow arrow keys. Real key "taps" are too short to move.
- **Crew interrupt tests:** set `app.crewReminders.nextReminderAt = Infinity` in the page (reload afterwards).
- **Floor taps only inspect;** walking is pad/keys, or tapping an object/NPC.
- With touch emulation (width < 768) the app pane sends clicks as mouse events that Phaser ignores: test canvas taps at ≥ 768 wide.
- **Pure rule checks:** compile `packages/shared/src/index.ts` with `tsc --module commonjs` into a temp dir and `require` it from node. A check used this session asserts that every value has a band, every band has a reply line, and each reading has exactly one crew owner.

## 8. Known issues and debt

- Confirm with the user: the radiation/CO₂ x2 choice, the invented bands, the cap of 30, and whether the placeholder species (flower / sunflower / tree) stay.
- Astronaut "mid-stride when stopped" report (§4), pending confirmation.
- All data is browser-only (localStorage): no server, no privacy enforcement, no family role.
- Emotes are still a placeholder popup. No app icons. Not tested on real phones.
- Plants have no animations. Cempasúchil shows 4 of its 8 stages.

## 9. Suggested next steps

1. Commit the astronaut work, merge `origin/main` (PR #9), resolve the two conflicts, verify in Chrome, push (when the user asks).
2. Close the "mid-stride" report with the user.
3. Crew NPC art: they still use placeholders (`CREW_LOOKS` in `asset-registry.ts`). The same pipeline and `anim` support can serve them.
4. Backend skeleton (NestJS + Postgres/Prisma) running `packages/shared` server-side (`decideReward` with bands, placement).
5. Health privacy on the server; family role; real-time second player.
6. Demo prep: seed data, script, deployment, app icons.
