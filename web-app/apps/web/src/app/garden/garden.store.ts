import { Injectable, computed, inject, signal } from '@angular/core';
import {
  CARE_RULES,
  CLAY_POT,
  CATALOG,
  CareAction,
  FERTILIZER,
  type GardenCommand,
  type GardenState,
  earnedToday,
  GARDEN_ROOM,
  GardenObject,
  RoomId,
  getStoreItem,
  owned,
  seedItemId,
  findPlacement,
  getCatalogItem,
  checkCare,
  getPlantStage,
  isThriving,
  matureAfterMs,
  getTileKind,
  growthAgeMs,
  isThirsty,
  msUntilMature,
  objectAtTile,
  propAtTile,
} from '@garden/shared';
import { timeAgo } from '../health/format';
import { whoDid } from '../shared/format';
import { type GardenFailure, type GardenReply, GardenService, LOCAL_PLAYER } from './garden.service';
import { type GardenNews, LiveChannel } from './live-channel';
import { describeNews } from './live-news';
import type { TileCoord } from './game/tile-manager';

const capitalise = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export type CloseupInfo = NonNullable<ReturnType<GardenStore['closeup']>>;
/** How a garden action went: what it made, or why not (see failureText). */
export type Outcome<T = object> = ({ ok: true } & T) | { ok: false; error: GardenFailure };
export type PlantOutcome = Outcome<{ object: GardenObject }>;

/** Garden domain state: plants, balance, the shared inventory, growth clock. */
@Injectable({ providedIn: 'root' })
export class GardenStore {
  private readonly service = inject(GardenService);
  private readonly live = inject(LiveChannel);
  /** The version of the state shown (server gardens only): anything older that arrives late is ignored. */
  private version = -1;
  /** Is the live channel up? (`reconnecting` shows in the HUD.) */
  readonly liveStatus = this.live.status;
  /** The latest thing someone else in the station did, e.g. "Mom watered the mustard." */
  readonly news = signal<{ text: string } | null>(null);

  readonly catalog = CATALOG;
  /** The station's shared state as last heard (empty until it loads). Everything below reads from it. */
  private readonly state = signal<GardenState | null>(null);
  readonly objects = computed(() => this.state()?.objects ?? []);
  readonly balance = computed(() => this.state()?.balance ?? 0);
  /** Shared household inventory: seed packets, fertilizer, decorations. */
  readonly inventory = computed(() => this.state()?.inventory ?? {});
  /** Recent store purchases (anyone in the household), newest first. */
  readonly purchases = computed(() => this.state()?.purchases ?? []);
  /** Notes pinned on the board (NotesStore adds the demo notes). */
  readonly notes = computed(() => this.state()?.notes ?? []);
  /** Decorations up in the station (anyone in the household placed them). */
  readonly decorations = computed(() => this.state()?.decorations ?? []);
  /** The purchases as one line: "You: Fertilizer (2 min ago) · Family: Photo frame (1 h ago)". */
  readonly recentPurchases = computed(() =>
    this.purchases()
      .map((p) => `${capitalise(whoDid(p.by, p.byName, LOCAL_PLAYER.id))}: ${getStoreItem(p.itemId)?.name ?? p.itemId} (${timeAgo(p.at)})`)
      .join(' · '),
  );
  /** Clock used for timestamp-based growth: the station's. */
  readonly now = signal(Date.now());

  /** Plant shown in the close-up view, if any. */
  readonly closeupId = signal<string | null>(null);
  /** Empty plot whose plant picker is open, if any. */
  readonly pickerTile = signal<TileCoord | null>(null);

  readonly closeup = computed(() => {
    const obj = this.objects().find((o) => o.id === this.closeupId());
    const item = obj && getCatalogItem(obj.itemType);
    if (!obj || !item) return null;
    const now = this.now();
    const total = matureAfterMs(item);
    const fertilizer = owned(this.inventory(), FERTILIZER);
    const ctx = { fertilizer, earnedToday: this.earnedToday() };
    const check = (a: CareAction) => checkCare(obj, a, now, ctx);
    return {
      object: obj,
      item,
      stage: getPlantStage(obj, now),
      progress: total ? Math.min(1, growthAgeMs(obj, now) / total) : 1,
      msToMature: msUntilMature(obj, now),
      ageMs: now - Date.parse(obj.createdAt),
      thirsty: isThirsty(obj, now),
      thriving: isThriving(obj, now),
      actions: { WATER: check('WATER'), FERTILIZE: check('FERTILIZE'), PRUNE: check('PRUNE'), HARVEST: check('HARVEST') },
      fertilizer,
      log: obj.care?.log ?? [],
      me: LOCAL_PLAYER.id,
      capReached: ctx.earnedToday >= CARE_RULES.dailyGardenCoinCap,
      /** Clay pots in the inventory (a grown plant can be potted with one). */
      pots: owned(this.inventory(), CLAY_POT),
    };
  });

  /** Garden coins the local player has earned today (capped daily, per UTC day). */
  readonly earnedToday = computed(() => {
    const state = this.state();
    return state ? earnedToday(state, LOCAL_PLAYER.id, this.now()) : 0;
  });
  /** Only a local garden can be reset (a station's is everyone's). */
  readonly canReset = this.service.canReset;

  constructor() {
    setInterval(() => this.now.set(this.service.now()), 1000);
    // Coming back to the tab: catch up with what the rest of the station did meanwhile.
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') void this.init().catch(() => {});
    });
  }

  async init(): Promise<void> {
    const { state, version } = await this.service.load();
    this.apply(state, version);
    // From now on, hear the rest of the station as it happens (reconnecting reloads, to catch up).
    this.live.start({ garden: (news) => this.heard(news), caughtUp: () => void this.init().catch(() => {}) });
  }

  /** Someone changed the garden (maybe us, on another device). */
  private heard(news: GardenNews): void {
    const text = news.by.id === LOCAL_PLAYER.id ? null : describeNews(news, this.objects(), this.decorations());
    this.service.heardFrom(news.serverTime);
    this.apply(news.state, news.version);
    if (text) this.news.set({ text });
  }

  /** Show the station's state as it now stands (after any change, ours or anyone's), unless we already show a newer one. */
  private apply(state: GardenState, version?: number): void {
    if (version !== undefined) {
      if (version < this.version) return;
      this.version = version;
    }
    this.state.set(state);
    this.now.set(this.service.now());
    if (this.closeupId() && !state.objects.some((o) => o.id === this.closeupId())) this.closeupId.set(null);
  }

  /** Ask the station; show its latest state whatever it answered. */
  private async send(command: GardenCommand): Promise<GardenReply> {
    const reply = await this.service.run(command);
    if (reply.state) this.apply(reply.state, reply.version);
    return reply;
  }

  postNote(content: string): Promise<Outcome> {
    return this.send({ type: 'POST_NOTE', content });
  }

  takeDownNote(noteId: string): Promise<Outcome> {
    return this.send({ type: 'TAKE_DOWN_NOTE', noteId });
  }

  async care(plantId: string, action: CareAction): Promise<Outcome<{ earned: number }>> {
    const reply = await this.send({ type: 'CARE', plantId, action });
    return reply.ok ? { ok: true, earned: reply.result.earned ?? 0 } : reply;
  }

  plantAt(tile: TileCoord): GardenObject | undefined {
    return objectAtTile(this.objects(), tile.x, tile.y);
  }

  isEmptyPlot(tile: TileCoord): boolean {
    return getTileKind(GARDEN_ROOM, tile.x, tile.y) === 'SOIL' && !this.plantAt(tile) && !propAtTile(GARDEN_ROOM, tile.x, tile.y);
  }

  /** Where `itemType` would go if planted around `tile`, or why it can't. */
  placementFor(itemType: string, tile: TileCoord) {
    return findPlacement(itemType, tile.x, tile.y, this.objects(), owned(this.inventory(), seedItemId(itemType)));
  }

  async plant(itemType: string, tile: TileCoord): Promise<PlantOutcome> {
    const spot = this.placementFor(itemType, tile);
    if (!spot.ok) return spot;
    const reply = await this.send({ type: 'PLANT', itemType, x: spot.x, y: spot.y });
    return reply.ok ? { ok: true, object: reply.result.object! } : reply;
  }

  /** Buy one of a store item into the shared inventory. Null when bought. */
  async buy(itemId: string): Promise<GardenFailure | null> {
    const reply = await this.send({ type: 'BUY', itemId });
    return reply.ok ? null : reply.error;
  }

  placeDecor(itemId: string, room: RoomId, tile: TileCoord): Promise<Outcome> {
    return this.send({ type: 'PLACE_DECOR', itemId, room, x: tile.x, y: tile.y });
  }

  moveDecor(decorId: string, tile: TileCoord): Promise<Outcome> {
    return this.send({ type: 'MOVE_DECOR', decorId, x: tile.x, y: tile.y });
  }

  waterDecor(decorId: string): Promise<Outcome> {
    return this.send({ type: 'WATER_DECOR', decorId });
  }

  /** Pot a grown plant (it moves from the garden into the inventory). */
  async potPlant(plantId: string): Promise<Outcome<{ itemId: string }>> {
    const reply = await this.send({ type: 'POT', plantId });
    return reply.ok ? { ok: true, itemId: reply.result.itemId! } : reply;
  }

  putAwayDecor(decorId: string): Promise<Outcome> {
    return this.send({ type: 'PUT_AWAY_DECOR', decorId });
  }

  /** Credit seeds earned elsewhere (health check-ins). */
  async credit(amount: number): Promise<void> {
    if (amount > 0) await this.send({ type: 'CREDIT', amount });
  }

  /** Demo: plant the starting garden again (a local garden only; see canReset). */
  async resetDemo(): Promise<void> {
    if (!this.canReset) return;
    this.service.resetLocal();
    this.pickerTile.set(null);
    this.closeupId.set(null);
    await this.init();
  }
}
