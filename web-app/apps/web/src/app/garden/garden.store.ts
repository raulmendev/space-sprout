import { Injectable, computed, inject, signal } from '@angular/core';
import {
  CARE_RULES,
  CLAY_POT,
  CATALOG,
  CareAction,
  type CareError,
  type DecorError,
  FERTILIZER,
  type CommandResult,
  type GardenCommand,
  type GardenState,
  type PotError,
  type PostNoteError,
  earnedToday,
  GARDEN_ROOM,
  GardenObject,
  Inventory,
  SocialNote,
  PlacementError,
  PlacedDecor,
  RoomId,
  Purchase,
  PurchaseError,
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
import { GardenService, LOCAL_PLAYER } from './garden.service';
import type { TileCoord } from './game/tile-manager';

const capitalise = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export type CloseupInfo = NonNullable<ReturnType<GardenStore['closeup']>>;
/** How a garden action went: what it made, or why not (`OFFLINE`: the station couldn't be reached). */
export type Outcome<T, E extends string> = ({ ok: true } & T) | { ok: false; error: E | 'OFFLINE' };
export type PlantOutcome = Outcome<{ object: GardenObject }, PlacementError>;
export type CareOutcome = Outcome<{ earned: number }, CareError | 'NOT_FOUND'>;
export type PotOutcome = Outcome<{ itemId: string }, PotError>;
export type DecorReply = Outcome<object, DecorError>;

/** Garden domain state: plants, balance, the shared inventory, growth clock. */
@Injectable({ providedIn: 'root' })
export class GardenStore {
  private readonly service = inject(GardenService);

  readonly catalog = CATALOG;
  readonly objects = signal<GardenObject[]>([]);
  readonly balance = signal(0);
  /** Shared household inventory: seed packets, fertilizer, decorations. */
  readonly inventory = signal<Inventory>({});
  /** Recent store purchases (anyone in the household), newest first. */
  readonly purchases = signal<Purchase[]>([]);
  /** Notes pinned on the board (NotesStore adds the demo notes). */
  readonly notes = signal<SocialNote[]>([]);
  /** Decorations up in the station (anyone in the household placed them). */
  readonly decorations = signal<PlacedDecor[]>([]);
  /** The purchases as one line: "You: Fertilizer (2 min ago) · Family: Photo frame (1 h ago)". */
  readonly recentPurchases = computed(() =>
    this.purchases()
      .map((p) => `${capitalise(whoDid(p.by, p.byName, LOCAL_PLAYER.id))}: ${getStoreItem(p.itemId)?.name ?? p.itemId} (${timeAgo(p.at)})`)
      .join(' · '),
  );
  /** Clock used for timestamp-based growth. */
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

  /** Garden coins the local player has earned today (capped daily). */
  readonly earnedToday = signal(0);
  /** The station's clock minus this device's: growth and cooldowns show as the station will judge them. */
  private clockOffsetMs = 0;

  constructor() {
    setInterval(() => this.now.set(Date.now() + this.clockOffsetMs), 1000);
    // Coming back to the tab: catch up with what the rest of the station did meanwhile.
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') void this.init().catch(() => {});
    });
  }

  async init(): Promise<void> {
    const { state, clockOffsetMs } = await this.service.load();
    this.clockOffsetMs = clockOffsetMs;
    this.apply(state);
  }

  /** Show the station's state as it now stands (after any change, ours or anyone's). */
  private apply(state: GardenState): void {
    const now = Date.now() + this.clockOffsetMs;
    this.objects.set(state.objects);
    this.balance.set(state.balance);
    this.inventory.set(state.inventory);
    this.purchases.set(state.purchases);
    this.notes.set(state.notes);
    this.decorations.set(state.decorations);
    this.earnedToday.set(earnedToday(state, LOCAL_PLAYER.id, now));
    this.now.set(now);
    if (this.closeupId() && !state.objects.some((o) => o.id === this.closeupId())) this.closeupId.set(null);
  }

  /** Ask the station; show its latest state whatever it answered. `E`: the refusals this command can get. */
  private async send<E extends string>(command: GardenCommand): Promise<Outcome<{ result: CommandResult }, E>> {
    const reply = await this.service.run(command);
    if (reply.state) this.apply(reply.state);
    return reply.ok ? { ok: true, result: reply.result } : { ok: false, error: reply.error as E | 'OFFLINE' };
  }

  async postNote(content: string): Promise<Outcome<object, PostNoteError>> {
    return this.send<PostNoteError>({ type: 'POST_NOTE', content });
  }

  async takeDownNote(noteId: string): Promise<boolean> {
    return (await this.send({ type: 'TAKE_DOWN_NOTE', noteId })).ok;
  }

  async care(plantId: string, action: CareAction): Promise<CareOutcome> {
    const sent = await this.send<CareError | 'NOT_FOUND'>({ type: 'CARE', plantId, action });
    return sent.ok ? { ok: true, earned: sent.result.earned ?? 0 } : sent;
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
    const sent = await this.send<PlacementError>({ type: 'PLANT', itemType, x: spot.x, y: spot.y });
    return sent.ok ? { ok: true, object: sent.result.object! } : sent;
  }

  /** Buy one of a store item into the shared inventory. */
  async buy(itemId: string): Promise<PurchaseError | 'OFFLINE' | null> {
    const sent = await this.send<PurchaseError>({ type: 'BUY', itemId });
    return sent.ok ? null : sent.error;
  }

  placeDecor(itemId: string, room: RoomId, tile: TileCoord): Promise<DecorReply> {
    return this.send<DecorError>({ type: 'PLACE_DECOR', itemId, room, x: tile.x, y: tile.y });
  }

  moveDecor(decorId: string, tile: TileCoord): Promise<DecorReply> {
    return this.send<DecorError>({ type: 'MOVE_DECOR', decorId, x: tile.x, y: tile.y });
  }

  waterDecor(decorId: string): Promise<DecorReply> {
    return this.send<DecorError>({ type: 'WATER_DECOR', decorId });
  }

  /** Pot a grown plant (it moves from the garden into the inventory). */
  async potPlant(plantId: string): Promise<PotOutcome> {
    const sent = await this.send<PotError>({ type: 'POT', plantId });
    return sent.ok ? { ok: true, itemId: sent.result.itemId! } : sent;
  }

  putAwayDecor(decorId: string): Promise<DecorReply> {
    return this.send<DecorError>({ type: 'PUT_AWAY_DECOR', decorId });
  }

  /** Credit seeds earned elsewhere (health check-ins). */
  async credit(amount: number): Promise<void> {
    if (amount > 0) await this.send({ type: 'CREDIT', amount });
  }

  /** Demo: plant the starting garden again, for everyone in the station. */
  async resetDemo(): Promise<void> {
    this.pickerTile.set(null);
    this.closeupId.set(null);
    await this.send({ type: 'RESET' });
  }
}
