# Space Sprout

A cozy space station shared by an astronaut and their family on Earth. Health check-ins earn seeds, and everyone grows a garden together with them. Built by team **AnkhTerrae** for the 2026 NASA Space Apps Challenge.

**▶ Play it now: https://garden.raulmen.dev** (type any name and press Start; no account needed)

**📱 Android app:** [download `space-sprout.apk`](https://github.com/raulmendev/space-sprout/raw/main/deploys/space-sprout.apk). Android may ask you to allow installing apps from this source. Play phones in landscape.

## Why

NASA research suggests that tending plants helps astronauts cope with isolation and confinement, which the Human Research Program lists as a spaceflight hazard. Daily health habits are also easy to let slide when no one is watching. Space Sprout joins the two: looking after yourself grows something you share with the people you love.

## What it does

The station has three rooms:

- **Medical Station:** the astronaut checks in on 10 readings (mood, sleep, heart rate, activity, water and more), by syncing a wearable (Health Connect on Android) or typing them in. Each check-in earns seeds, with goal and streak bonuses. **Health Insights** shows 7-day trends with neutral explanations: no thresholds, no diagnosis. Missing a day is never punished.
- **Garden:** seeds buy and grow 14 plant species, from lettuce and mustard (crops astronauts grow on the ISS) to cempasúchil and nopal. A plant glows in its close-up when it's thriving, and you can name it after a memory. The Supply Store sells pots and decorations.
- **Social Space:** a message board and emotes. Messages are never locked behind seeds.

Everyone in a station shares one garden and sees each other walk around in real time. Health data stays private to each member: the station only hears about the seeds. Friendly crew members and pets wander the station and ask about your day.

## How it's built

| Folder | What |
|---|---|
| [`web-app/`](web-app/) | Angular + Phaser 3 + Tailwind client, wrapped as an Android app with Ionic Capacitor. Deployed on Cloudflare. |
| [`api/`](api/) | NestJS + TypeORM API on Neon Postgres, with a WebSocket live channel. Deployed on Railway. |
| [`shared/`](shared/) | `@garden/shared`: domain types and pure game rules, used by both the web app and the API, so they enforce the same ones. |
| [`deploys/`](deploys/) | The Android APK. |

Each folder's README explains how to run it locally. The illustrated art was made by our design team.

## NASA resources

- [Can Space Gardening Help Astronauts Cope With Isolation?](https://www.nasa.gov/humans-in-space/can-space-gardening-help-astronauts-cope-with-isolation/)
- [Veggie: Vegetable Production System](https://science.nasa.gov/mission/veggie/) and [Growing Plants in Space](https://www.nasa.gov/exploration-research-and-technology/growing-plants-in-space/)
- [Human Research Program](https://www.nasa.gov/hrp/): [Hazards of Human Spaceflight](https://www.nasa.gov/hrp/hazards/), [Isolation and Confinement](https://www.nasa.gov/hrp/hazard-isolation-and-confinement/), [Risk of Behavioral Changes and Psychiatric Disorders](https://www.nasa.gov/reference/risk-of-behavioral-changes-and-psychiatric-disorders/)
- [Wearable Tech for Space Station Research](https://www.nasa.gov/humans-in-space/wearable-tech-for-space-station-research/)
- [TechPort: Increasing Cognitive Reserve with Software (Pilot)](https://techport.nasa.gov/projects/116443)
- [Siete maneras de favorecer el sueño de los astronautas](https://ciencia.nasa.gov/sistema-solar/siete-maneras-de-favorecer-el-sueno-de-los-astronautas-que-pueden-ayudarte-a-dormir-mejor-en-la-tierra/) (NASA Ciencia)

Also: [Sustaining the Merry Space Farmer with Pick-and-Eat Crop Production](https://www.nature.com/articles/s41526-025-00513-9) (npj Microgravity, 2025).

## License

[MIT](LICENSE)
