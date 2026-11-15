# Handoff: Jardín Comunal (as of 2026-11-15, night)

Two people work on this repo with Claude, each in their own checkout, plus Claude agents in worktrees, and all of them merge PRs into `main`.
**Always `git fetch` before starting.** `main` moves fast: PRs #27–#40 all landed on 2026-11-15.

## 1. Where things stand (read this first)

**Repo:** `github.com/raulmendev/astro-garden` (private).
- `web-app/`: the Angular web client.
- `api/`: the NestJS API.
- `shared/`: the game rules, at the repo root (moved there in #17).

**Live:**
- Web: **https://garden.raulmen.dev** (Cloudflare Worker, #37; `npm run deploy:cloudflare` in `web-app/apps/web`).
- API: Railway (#30, #31). Its `CORS_ORIGINS` must include `https://garden.raulmen.dev`.
- Android: a Capacitor app with Health Connect sync (chucordova).

**`main` = `1e6439d`** (PR #40). Merged PRs so far:
- **#1–#5:** plant care, close-up, full-screen layout, terminal look, station crew.
- **#6–#9:** Supply Store, inventory, message board with Health Insights goals and streaks, decorations.
- **#10:** Garden room art.
- **#11–#12:** QA, potted plants.
- **#13:** HUD buttons.
- **#14:** Social Space art and full-resolution rendering (§3).
- **#15:** Health Insights cards scroll.
- **#16:** placeholder plants removed from the store.
- **#17:** NestJS API skeleton on Neon; the shared rules move to the repo root.
- **#18:** store item sprites, and drawn shadows on the Garden props.
- **#19:** contact shadow under the astronaut.
- **#20:** new purple pot for potted plants.
- **#21:** cleanups of #18–#20.
- **#22, #25:** stations, members and sessions on the server, behind a start menu; station keys; name tags above players.
- **#23:** Social Space animated windows.
- **#24:** characters kept off the painted walls (`floor` edges per room).
- **#26:** Medical Bay: painted room, real stations, animated windows, furniture (§3).
- **#27:** "Pot it" in the plant close-up is a round button.
- **#28:** Rabanito replaces Sprout as the garden guide.
- **#29:** the garden on the server: one shared state per station, changed by commands.
- **#30, #31:** the API deployed on Railway.
- **#32:** live updates: every change reaches the rest of the station as it happens.
- **#33:** the emote wheel (§5), plus the #26 cleanups (prop states fall back to the idle picture).
- **#34:** Medical Bay supply cart moved 3 tiles up.
- **#35:** health on the server: each member's private record; seeds paid in the same transaction; `CREDIT` removed (§8).
- **#36:** Medical Bay and Social Space props come alive (§3).
- **#37:** the web app deployed as a Cloudflare Worker (garden.raulmen.dev).
- **#38:** presence: everyone in the same room sees each other walk, in their suits, with name tags and emotes (signed-in players only).
- **#39:** real art and shop icons for the 5 store decorations, plus 5 new ones (§3, §4).
- **#40:** a loading screen instead of a black screen while the game loads.
- **#41:** new space-station art on the loading screen.
- **#42:** plant labels: name a plant after a memory (§3). **Deploy the API before the web app**: an older API refuses to sell labels ("Currently unavailable.").

**Raúl's session on 2026-11-15 (afternoon to night), in order:** #33 emotes (a HUD wheel iterated with the user against a design concept), #36 room animations in code, #39 decorations. Each feature followed the same pattern: build → check in the Playwright phone window (and frame by frame at 1280×800 for animations) → `/simplify` (4 review agents) → "commit, push and merge".

Also on `main` without a PR (chucordova):
- the new astronaut and the family user;
- crew art for all four crew members;
- suits: green, black, wine, purple, cactus and leaf;
- station pets: Bolita the dog, Miso the cat and Rabanito the radish;
- the start menu itself;
- touch controls: pad on the left, A button on the right;
- an Android app (Capacitor) with Health Connect sync at the medical terminal.

**In flight:** nothing on Raúl's checkout. Also on `main` without a PR since #40: chucordova's start-menu fit, stacked terminal cards and Health Connect steps → exercise minutes.

**Checkouts and who uses them:**

| Where | Who | Notes |
|---|---|---|
| `~/Documents/ardencemx/astro-garden` (macOS) | Raúl | Chat in **English**. Dev server on **4200**. Commits as Raul Mendez. |
| `.claude/worktrees/garden-qa` (same Mac) | another Claude agent | Last on `feat/presence` (#38, merged). Servers on 4201/4202. Never edit, stash or stop anything there; reading is fine. |
| `.claude/worktrees/garden-qa-2` | another Claude agent | Last on `feat/loading-screen` (#40, merged). Same rules. |
| `C:\Users\jesus\Desktop\Astro Garden\astro-garden` (Windows) | chucordova | Chat in **Spanish**. Commits with `git -c user.name=chucordova -c user.email=jesusremedios.cordova@gmail.com commit …`. `npm.cmd`, not `npm`. `apps/web/angular.json` `"analytics": false` stays uncommitted there. |

**Stash on Raúl's checkout:** `stash@{0}` ("handoff edits (garden art session)") holds an old version of this file. It's superseded and can be dropped.

**Running it:**
- **Web:** `cd web-app && npm install && npm run dev:web` → http://localhost:4200.
  - The page opens on the start menu: name, suit, astronaut or family, and an optional station key.
  - `?user=astronaut|family` (optionally with `&suit=`) skips the menu without the API, in dev only.
- **API:** `cd api && npm install && npm run start:dev` → port 3000.
  - It needs `api/.env` with `DATABASE_URL` (Neon); see `api/.env.example`.
  - Migrations: `npm run migration:run`. The demo station key is `GARDEN`.
  - The web app finds the API on port 3000 of whatever host served the page.
  - If the API can't be reached, the last session on the device is used.
- If the user "doesn't see" new work, `ng serve` may be serving a stale bundle after a compile error. Restart it, then hard-reload.
  - **As of this handoff, Raúl's server on 4200 is stale** (it predates #33). Restart it (`npm run dev:web`). Claude tested on a throwaway `npx ng serve --port 4213` (stopped) rather than restarting the user's server.
  - Check what's served with `curl -s localhost:4200/<chunk>.js | grep -c <new symbol>`, or in the page by fetching the loaded scripts.

**Checks used every time:**
- Build (also type-checks templates): `cd web-app/apps/web && npx ng build --configuration development`
- Unused code: `npx tsc -p tsconfig.app.json --noEmit --noUnusedLocals --noUnusedParameters`. One known, harmless hit: the unused `action` in `plant-closeup.component.ts`.
- API: `cd api && npm run typecheck`. Its `node_modules` aren't installed on Raúl's checkout yet.
- No merge markers: `grep -rn "^<<<<<<<" web-app/apps web-app/tools shared api/src`.
- Every manifest key has a file:
  ```bash
  cd web-app/apps/web/public/assets/game && python3 -c "import json,glob,os;k=json.load(open('manifest.json'))['delivered'];f={os.path.splitext(os.path.basename(p))[0] for p in glob.glob('**/*.png',recursive=True)};print([x for x in k if x not in f])"
  ```

## 2. Architecture

```text
shared/src/                     game rules, pure TS, used by web and API (@garden/shared)
  types/domain.ts               HealthMetric (10), CrewId, PetId, HabitatInteraction, RewardTransaction…
  contracts/habitat.ts          ROOMS: 24×16 tiles each (layout + props + doors + painted `floor` edges)
  contracts/rules|movement|motion.ts   placement, walkability (props block their footprint), free movement, wall margins
  contracts/health|checkin|insights|goals.ts   readings, answer bands → seeds, usual ranges, goals/streaks
  contracts/crew.ts             who asks about what; pets
  contracts/store|notes|decor|potting.ts      Supply Store, post-its, decorations, potted plants
  SUITS, USER_ROLES, Member, station-key rules
api/src/                        NestJS + TypeORM on Neon: household / member / session; global session guard
web-app/
  apps/web/src/app/
    app.ts                      shell; every tap → use() → act()
    habitat/                    HabitatStore (render state, actors), PlayerStore, HUD, panels
    garden/game/                Phaser: habitat.scene.ts, tile-manager.ts (fitToGame), habitat-renderer.ts,
                                asset-registry.ts, notice-board.ts (board geometry)
    garden/ health/ npc/ social/ store/ decor/
  apps/web/public/assets/game/  art + manifest.json → `delivered`
  tools/                        art import scripts (§4)
```

**Principles to keep:**
- **Phaser only draws and reports clicks.** State lives in Angular signals; the scene gets `setState` and `setActors`.
- **Rules stay pure in `shared/`,** so the server runs the same ones.
- **Art goes through `asset-registry.ts` + `manifest.json` → `delivered`.**
  - An undelivered key gets a placeholder, never a crash.
  - A key with a `fallback` (prop states) reuses the fallback's delivered art instead.
- **Phones are landscape-only.** Test at **844×390** and **667×375**; popups have one fixed height and their body scrolls.
- **No judgement in plants or health.** Seeds come mainly from health habits. The habitat is shared with the family (cooperative).

## 3. Rendering and art (Raúl's sessions, PRs #10, #14, #26, #36, #39)

**Grid:** a tile is **32 px** in game and a room is 24×16 tiles = **768×512**. Art is delivered and stored at **2×**: 64 px per tile, rooms 1536×1024.

**Full-resolution rendering** (`habitat-renderer.ts`, `tile-manager.ts`):
- The canvas renders at the screen's real resolution (`zoom × devicePixelRatio`, capped at 4), and the camera zooms to fit. It only reallocates when the size actually changes.
- `fitToGame(img)` draws any texture at least 1.5× its registered width at that width, with smooth filtering. It caches one scale per texture key (`restingScale`).
- Pixel placeholders and 1× art stay 1:1 and crisp.
- **So the registered size in `PROP_VISUALS` is the drawn size.** Copy the size the import tool prints.
- Tweens scale relative to `restingScale(img)`. `popIn()` is the one pop-in effect.

**Painted rooms:** all three rooms now have one. `room-<id>.png` in `habitat/rooms/` replaces the room's tiles (`drawGround`).
- The room's `layout` in `habitat.ts` must match the picture: walls, doors on rows 7–8, rug tiles.
- **`floor` edges** (#24) record where the painted floor ends, in tiles, measured on the wall outlines. Characters keep a body-wide margin from them.
- **Animated windows** (#23): `roomWindows('<ROOM>', …)` in `asset-registry.ts`, one line per room, printed by `tools/import_windows.py`.
  - The frames play over the picture, every 170 ms.
  - With reduced motion, the first frame stays.
  - Social Space and Medical Bay have them.
- Watered soil is a translucent overlay, so it works on both painted and tiled rooms.

**Prop effects** (code-drawn until the design team sends animation frames; the user approved this look):
- `fx` in `PROP_VISUALS` (`asset-registry.ts`): `glow` (an area brightens and dims; `ellipse` for bulbs and lanterns, may reach past the art) and `sweep` (a band crosses a screen: `right`, `down` or `updown`). Rects are game px from the art's top-left at its registered size.
- The scene bakes each shape into a texture once and draws it additively just in front of the prop. Only over a real loaded picture, never a placeholder, and not on a prop that sways or pulses (the light would slide off).
- Medical Bay: terminal (heartbeat glow + ECG redraw), Health Insights (body chart refresh, tube, DNA screen), scan pod (scanning band). Social Space: kiosk (sign, strips, counter screen), floor lamp halo, coffee-table lantern flicker.
- `sway: true` rocks small potted plants. The wide planters and the hanging vines stay still on purpose (they tilt like boxes).
- With reduced motion, glows stay half lit and nothing sweeps.
- Decorations get the same effects through `DECOR_VISUALS` (below).

**Decorations (PR #39),** store items players place (`DECOR_SPECS` in `shared/src/contracts/decor.ts`, Social Space only):
- Art from `Jardin_Comunal_Decorations_Sprites_and_Minis.zip` (photo frame, Earth poster, fairy lights, cozy rug, star lamp, each with a shop icon) and five single exports (terrarium, holo globe, keepsake shelf, memory board, galaxy lamp; no icons, so their store cards are the sprite fitted).
- `DECOR_VISUALS` in `asset-registry.ts`: one row per decoration with its drawn size (printed by `tools/import_decor.py`) and glows. Each fairy-light bulb twinkles on its own; the star lamp, holo globe and galaxy lamp breathe.
- A sprite may overhang its footprint: the cozy rug is 92×58 on 2×2 tiles. Don't widen a footprint to fit art: placed decorations store only their top-left, so the change would move existing ones into walls or stations.

**Plant labels** (PR #42): name a plant after a memory ("Birth of Johanna").
- Rules in `shared/src/contracts/labels.ts`: a **Plant label** store item (Gardening, 3 seeds, 1 in the starter inventory). Naming a plant with no label uses one; renaming is free and anyone can; an empty name takes it off (no refund). 24 characters, one line. `GardenObject.label`; command `LABEL`.
- Harvesting or potting a plant takes its label with it (a potted plant is just an inventory count).
- Art: `Pixel Art Purple Sci-Fi Garden Sign.png` → `tools/import_label.py` (black background, cleared with a tight tolerance plus the enclosed hole between the posts).
- Room: a little sign (`plant-label-mini`, 26×13) at every named plant's front-left. The big sign with the name opens for every named plant within reach, and the one under the pointer. It's a fixed size on screen like the name tags; plants in the top row show it under them, clear of the HUD.
- Close-up: the sign stands in the plant's soil, over its foot (absolutely placed, so the fixed-height popup never grows). Unnamed plants show it faded with "🏷️ Name it" (or "🛒 Get a label" when none are owned). Tap it to write; ✓ / ✕ beside it, Enter saves, Esc cancels without closing; an empty name shows 🗑️ and takes the label off. The name is sized to fill the panel (`--chars` + container units).
- Pre-existing, not from labels: at 667×375 the close-up body runs 16 px over (the "Pot it" row).

**Garden (PR #10):**
- Room art from `Jardin_Comunal_Layout_Tiles_128px_CORREGIDOS.zip`.
- Five props: bench (top left), vine planter (top of the centre path), greenhouse and watering station (top right), vine arch (bottom of the centre path).

**Social Space (PR #14),** laid out after the user's target mockup (`Jardin_Comunal_Lounge_Sprites_CONCEPT.zip` → `reference_full_room_and_catalog.png`):
- **Room:** `Jardin_Comunal_Social_Space_Empty_Room_Tileset.zip` → `reconstructed_room_1536x1024.png`. The back wall comes down to row 3, so the floor starts at row 4.
- **Rug:** painted into the picture (walkable): `FLOOR` in `import_room.py`, `RUG` tiles cols 8–15, rows 7–10.
- **Message board (top left):** from `Jardin_Comunal_Social_Space_Sprites_2x.zip`, with real note and bubble sprites. Board geometry is in `notice-board.ts` (`BOARD_SIZE` 124×113, cork at 9,25 · 106×50).
- **Supply kiosk (top right):** `Purple Sci-Fi Supply Kiosk.png`, delivered with a white background.
- **Lounge, all at player scale:** sofa with throw, floor lamp, monstera, two side armchairs (16 px further out than the table), decorated coffee table, two poufs. Sofa, armchairs and poufs come from `Jardin_Comunal_Sofas_Armchairs_Poufs_With_Shadows.zip`.
- **Plants:** a pink flower pot by the board and a lavender pot by the kiosk. Lavender and red-flower planters in the front corners, hanging vines in the top corners.
- **Removed on purpose:** the **Earth Link** (the board covers messaging) and the **Emote corner**, including its panel, interaction type and `SocialEmote`.

**Medical Bay (PR #26),** laid out after the design team's layout guide (zones plus a waiting-rug placement sheet):
- **Room:** `Medical_Bay_Tileset_2x.zip` → `reference/medical_bay_full_1536x1024.png`.
  - It has the same frame as the Social Space: floor from row 4.
  - Only the west door works. The east door in the picture stays wall, since nothing lies beyond it.
  - `floor` edges: 2.15 / 4.2 / 21.9 / 14.35.
- **Windows:** `Medical_Bay_Animated_Windows_2x.zip`, at (224, 56), 320×56.
- **Stations:** the Medical Terminal (`Pixel-Art Sci-Fi Medical Station.png`) and Health Insights (`Pixel-Art Futuristic Health Console.png`) stand either side of the Earth window.
  - Both are imported at the same scale (0.074), so their stools match.
  - There's one picture each, the idle state. The other states show it through the registry `fallback`, and `attention` still pulses.
- **Zones** (from the guide):
  - **Diagnostics on the back wall:** terminal at cols 4–5; Insights at 17–19 with the medicine shelf at 20–21.
  - **Treatment on the right:** bed at 18–20, row 9; scan pod at 20–21, row 13; lavender against the wall between them.
  - **Locker:** on the left wall at 2–3, row 10.
  - **Waiting area:** a rug painted into the picture (`FLOOR` in `import_room.py`: 255×92 at 208,354; `RUG` cols 7–13, rows 11–13). On it, two **rear-view** benches (cols 7–9 and 11–13, row 12) with a leafy pot between them at col 10.
  - **The supply cart** stands on the floor cross (cols 11–12, row 8): the user's call, overriding the guide's "keep the cross clear".
- **Changes from the design guide, and why:**
  - **The waiting area sits one row higher than the guide says** (rows 11–13, not 12–14). The bottom wall starts at y 459, so the guide's position would paint rug over it.
  - **The benches are the rear view.** The sheet's front-view benches looked like they faced the wall.
  - **The pots stand against walls or furniture.** The user rejected a pot standing alone in the open floor.
- **Not used yet:** the side-view bench (`Futuristic Medical Bay Couch Sprite-2.png`, faces right), and from `Medical_Bay_Furniture_Export.zip` the DNA station, the loose stool and the floor emblem. The room already has the emblem painted in.

**Scale rule the user enforced:** size furniture against the astronaut (36×50). An armchair is about 80% of their height, a pouf knee-high, a pot below the waist.

**Shadows the user enforced:** no shadow looks like a sticker. A shadow under the lowest pixel looks like the piece floats when parts reach lower than its feet, such as a desk's stool. Use the `feet` step for those (§4).

## 4. Art import tools (`web-app/tools`, Pillow)

Pillow isn't installed system-wide on the Mac: use a throwaway venv (`python3 -m venv <dir> && <dir>/bin/pip install pillow`) and run the tools with it.

| Tool | Does |
|---|---|
| `import_room.py <room> <tiles folder or PNG> [floor folder]` | Stitches `tile_rNN_cNN.png` (or takes one picture), paints out our UI baked into the art (`BAKED_UI`), lays floor pieces such as rugs (`FLOOR`), writes 2×, marks delivered |
| `import_props.py <pack folder>` | For each file in `PROPS` found in the pack: clears a flat background (RGB art), runs the cleanup steps, trims, scales, writes 2×, prints the game size, marks delivered. Run it once per pack. |
| `import_windows.py <room> <pack folder>` | Copies a pack's window overlay frames, marks them delivered, prints the `roomWindows(...)` line. Reads both manifest layouts the design team has used. |
| `import_board.py <pack folder>` | Board, three notes, unread bubble |
| `import_pot.py` | The potted-plant pot's two layers (behind and in front of the plant) |
| `import_label.py <PNG>` | Plant label: the big sign, the little one and its store card; prints the cream panel (`LABEL_PANEL`) |
| `import_decor.py <folder>` | Store decorations: map sprite `decor-<item>` (sized to the astronaut, shadow if it stands on the floor) and store card `store-<item>` (the pack's `<item>_icon.png`, else the sprite fitted). Prints sizes for `DECOR_VISUALS`. |
| `art.py` | Shared steps: `trim`, `clear_background`, `drop_glow`, `components`/`only`, `drop_strays`, `seat_shadows`, `add_shadow`, `save_scaled` (optional `detail` above 2x), `icon_from` (store cards), `mark_delivered`, `HI_RES = 2` |

**Cleanup steps per sprite** (4th field of a `PROPS` entry):
- `glow`: clear a soft glow halo.
- `seat`: pull a contact shadow exported with a gap up under the feet.
- `shadow`: draw a stepped purple contact shadow matching the furniture pack: colour (52, 31, 79), alpha 32/78/128/169.
- `feet`: the same shadow, centred on the piece's feet line, meaning the lowest row it spans at least 60% of its width, rather than its lowest pixel. For desks with a stool in front, benches and carts.

**Adding a prop:**
1. Add a row to `PROPS` (file → kind, folder, scale, steps) and run the tool.
   - A prop with visual states (`PROP_VISUALS.states`) takes the state in the kind, e.g. `MEDICAL_TERMINAL_IDLE`.
   - Deliver at least the idle one. A later state picture is just another row.
2. Copy the printed size into `PROP_VISUALS` in `asset-registry.ts`.
3. Place it in `ROOMS` in `shared/src/contracts/habitat.ts`: footprint in tiles from the top-left, sprite anchored bottom-centre. Props block their footprint, plants included; only plants and pots that players place are walk-through.
4. Rename downloads with spaces (e.g. `Pixel-Art Sci-Fi Medical Station.png`) to the name in `PROPS`, and put each one in a folder of its own.

**Sizing a single picture against a pack:** match a shared detail (the desks' stools) or a measured width (the rear bench matches the front bench's 63 px). Measure the trimmed size first:
```bash
<venv>/bin/python -c "from PIL import Image; from art import trim, drop_strays; print(trim(drop_strays(Image.open('<file>'))).size)"
```

**Gotcha:** `sofa_with_blanket.png` is in both the sofa zip and the shadows zip. Import the shadows zip last.

**What the design team's packs are like** (tell them when asking for more):
- They're AI concept art, cut out automatically: slivers of neighbouring sprites, glow halos, white backgrounds, and shadows drawn with a gap.
- Sizes are arbitrary: always size against the astronaut.
- Their placement guides can ignore our wall thickness. Check a guide's rows against the room's `floor` edges.
- When they send front views only, ask for the view a spot needs. A bench against the bottom wall needs its back to the camera.

## 5. Crew, pets and players (chucordova's sessions, on `main`)

**Emotes** (Raúl's session; `contracts/emotes.ts`, `habitat/emote-wheel.component.ts`):
- The 😊 HUD button opens a wheel: 8 emotes on a see-through pink ring, purple slots, a dark centre that names the one under the pointer or focus. One tap sends; Escape or a tap outside closes; arrow keys go round.
- The emote shows in a cream bubble above the name tag for 3 s (`EMOTE_MS`), with a wave if standing. Walking keeps it.
- Presence (#38) sends them, so everyone in the station sees them; `EMOTES` ids live in `shared/`.
- The user iterated on the look against a design-team concept (an "Emote Wheel Preview" image). Settled: 💚 Love, 😊, 👋, 🌱, ⭐, 🤗 Hug (🫂 renders grey on some devices), ✅ Yes, ❌ No.
- Below 768 px the HUD shows only the player's icon, not their name, so the extra button fits at 667 px.

**Check-ins** (`contracts/crew.ts`, `contracts/checkin.ts`, `npc/crew-lines.ts`):
- Dr. Mira asks mood, sleep, temperature and heart rate. Coach Tao asks activity and stress. Chef Rosa asks calories and water. Dr. Okafor scans radiation and CO₂.
- Each answer falls in a band paying x1–x4 seeds. The daily cap is 30; goal and streak bonuses are paid on top.
- "Later" or ✕ sends you to finish at the Medical Station.
- The terminal lists all 10 readings, with one manual-entry tab per crew member.
- **Unconfirmed with the user:** radiation/CO₂ at x2, the invented temperature/heart-rate/calorie bands, and the cap of 30.

**Astronaut** (`Jardin_Comunal_Astronauta_*` zips):
- Walks in 4 directions × 4 frames, with a standing pose per direction and a 6-frame wave on starting a conversation.
- Six suits (`SUITS` in shared).
- A drawn contact shadow (#19) and a name tag above the head (#25).
- Open report: the astronaut "stays mid-stride when stopped". A room-change cause was fixed; not confirmed by the user since.

**Crew art:** real sprites for all four, a pose per direction, a happy pose while talking, and the robots hover.

**Pets:** Bolita (dog, starts in the Social Space), Miso (cat, starts in the Medical Station) and Rabanito (radish).
- They roam like the crew but don't hover.
- "Pet …" shows a speech bubble; pets never ask for readings.
- Use `isCrew` / `isPet`, not "not Sprout".

## 6. How the users like to work

- **Raúl**
  - Iterates visually from the design team's files in `~/Downloads` and a **target mockup or guide**. Follow the guide's **placement**, but size against the player, and adjust when the guide doesn't fit our walls; say why.
  - Short follow-ups ("put the cart in the middle of the +", "the shadows make it look like it's floating"): when ambiguous, ask one short question with options.
  - Wants furniture against walls or other furniture, not floating alone in the open floor.
  - Watches in a **Playwright phone window (844×390)**. Leave it on the room you changed and bring it to the front. A 1280×800 view helps for close-ups; switch back afterwards.
  - "Commit, push and merge" means: commit → fetch → merge `origin/main` into the branch → build + browser re-test → push → `gh pr create` (body ends with the Claude Code line) → `gh pr merge --merge` → fast-forward local `main`.
  - Commits end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
  - Uses `/simplify`: report what was fixed and what was skipped.
  - Iterates on looks in short steps ("better but not quite there", "now blue", "the circle pink"). Make the change, screenshot it, and say what changed; when a request is vague ("more ui wise"), make a concrete polish pass rather than a long question.
  - Asks for `/simplify` after each feature, then "commit, push and merge"; keeps `HANDOFF.md` current in each PR.
- **chucordova**
  - Pushes straight to `main` after checking for conflicts.
  - Wants to watch tests in Chrome (Claude in Chrome extension).
  - The working tree is CRLF: keep each file's line endings.

## 7. Testing tips

- **Start menu:** type any name and press Start to get in. `?user=astronaut` skips it in dev.
- **App state:** `ng.getComponent(document.querySelector('app-root'))` gives `.player`, `.habitat`, `.garden`, `.health`.
  - Jump rooms with `player.position.set({ room: 'MEDICAL', x: 12, y: 8 })`.
  - Open panels with `habitat.openPanel.set('STORE_SELECTED')`.
  - Force a station state with `habitat.propStates.MEDICAL_TERMINAL.set('attention')`.
- **Fit inside a popup:** measure on `.panel-body` (`scrollHeight - clientHeight`), not the dialog.
- **Tap checks:** click a station and wait about 4.5 s, since the player walks there first, then read `habitat.openPanel()`.
- **Sprite checks:** compose the PNG over the room's floor next to the astronaut (`characters/player-astronaut-black-down-3.png`, 72 px wide at 2×) and look at it before placing. Then screenshot the room with the astronaut standing next to the new piece.
- **Reachability:** after moving props, flood-fill the room's walkable tiles from the door (layout minus prop footprints) and check none are cut off. The Medical Bay has 218, all reachable.
- **Animation checks:** take 4–5 screenshots ~450 ms apart at 1280×800 and crop each animated piece into one strip (Pillow in a throwaway venv). Two frames often miss a glow's peak.
- **Decorations:** give seeds by editing the save (`balance` in `jardin-comunal:garden:v9`) and reloading, then `garden.buy(id)` and `garden.placeDecor(id, 'SOCIAL', {x, y})`; it returns `{ ok, error }` (e.g. `TILE_OCCUPIED`, `WRONG_SURFACE`). Wall decorations go on row 1.
- Zoneless Angular: wait about 300 ms after a click before reading the DOM.
- `localStorage.clear()` + reload gives the seeded demo (dev stand-in only; signed-in players use the server). The garden save key is `jardin-comunal:garden:v9`.

## 8. Known issues and debt

- **Memory:** every room picture (3 × 1536×1024), every window frame and every delivered game key load at boot (UI-only pictures such as store cards and close-ups no longer do, since #39). Load per room when it matters. A spritesheet per room's windows would save 7 requests each (16 window frames ≈ 4.6 MB of GPU memory).
- **Half-tile positions:** furniture can't use them yet. The Social Space armchairs and table, and the Medical rug, which is shifted 16 px to centre on the benches, work around it.
- **Medical Bay:**
  - The furniture may want to be ~15–25% larger (the design guide's last step); not tried yet.
  - The station states have no art of their own yet, so the map no longer shows the ↻/✓ glyphs.
- **Health** is on the server since #35: private per member, the station only hears the seeds. Its follow-ups: the crew have no "can't reach the station" line, and the reward ledger needs pruning before records get large.
- **Station keys:** no password, and `POST /api/join` isn't rate-limited.
- **Decorations:**
  - Wall ones can only go on row 1 of the Social Space (`V` tiles), the top band of the painted wall; rows 2-3 would look more natural, but moving them invalidates wall decorations already placed.
  - The 5 new items (terrarium 14, holo globe 22, keepsake shelf 16, memory board 12, galaxy lamp 18) got names and prices from Claude; confirm with the user. Their store cards are the sprite fitted, since no minis were drawn.
  - Decorations are allowed in the Social Space only (`DECOR_ROOMS`).
- **Social Space back wall:** the empty middle, under the Earth window, could take the unused hanging baskets or wall shelf from `Jardin_Comunal_Planters_and_Pots_Sprites.zip`.
- **Devices:** not tested on real phones. No app icons.

## 9. Suggested next steps

1. Restart the dev server on 4200, and drop `stash@{0}` on Raúl's checkout (an old copy of this file).
2. Confirm the 5 new decorations' names and prices, and whether wall decorations should hang lower (§8).
3. Animation frames: if the design team draws any, ask for PNG frames of only the moving part plus its position on the picture (like the windows), packed one sheet per room. Code effects stay for lights and screens (they cost almost nothing).
4. Medical Bay polish:
   - the ~20% furniture size test, with before/after side by side;
   - place or drop the side-view bench;
   - ask the design team for per-state terminal and insights pictures.
5. Confirm the open check-in questions and the "mid-stride" report with chucordova.
6. The family role on the server (what family members see and can do, now that health is private).
7. Demo prep: seed data, a 2–3 minute script, app icons. The web app and API are already deployed.
