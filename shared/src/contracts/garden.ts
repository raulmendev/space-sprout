import type { Actor, CareAction, GardenObject, SocialNote } from '../types/domain';
import { type CareError, applyCare, careDay, checkCare } from './care';
import { type DecorChange, type DecorError, type PlacedDecor, moveDecor, placeDecor, putAwayDecor, waterDecor } from './decor';
import type { RoomId } from './habitat';
import { canTakeDown, checkPostNote, noteText, type PostNoteError } from './notes';
import { type PotError, potPlant } from './potting';
import { type PlacementError, validatePlacement } from './rules';
import { FERTILIZER, type Inventory, POST_IT, type Purchase, type PurchaseError, STARTER_INVENTORY, applyPurchase, consume, owned, seedItemId } from './store';
import { getCatalogItem } from './catalog';

/** Seeds each person earned from garden care on one (UTC) day, for the daily cap. */
export type GardenEarnings = Record<string, { day: string; amount: number }>;

/**
 * Everything a station shares: the garden, the seeds balance, the inventory, purchases,
 * decorations and the notes on the board. The server keeps one per station and is the
 * authority; every change goes through `runCommand`.
 */
export interface GardenState {
  gardenId: string;
  balance: number;
  objects: GardenObject[];
  earnings: GardenEarnings;
  inventory: Inventory;
  /** Recent purchases, newest first. */
  purchases: Purchase[];
  notes: SocialNote[];
  /** Decorations placed in the station (taken out of the inventory while they're up). */
  decorations: PlacedDecor[];
}

/** What a player asks the station to do. */
export type GardenCommand =
  | { type: 'PLANT'; itemType: string; x: number; y: number }
  | { type: 'CARE'; plantId: string; action: CareAction }
  | { type: 'BUY'; itemId: string }
  | { type: 'POT'; plantId: string }
  | { type: 'PLACE_DECOR'; itemId: string; room: RoomId; x: number; y: number }
  | { type: 'MOVE_DECOR'; decorId: string; x: number; y: number }
  | { type: 'WATER_DECOR'; decorId: string }
  | { type: 'PUT_AWAY_DECOR'; decorId: string }
  | { type: 'POST_NOTE'; content: string }
  | { type: 'TAKE_DOWN_NOTE'; noteId: string }
  /**
   * Seeds from a health check-in. TRUSTED: the browser decides the amount until health
   * moves to the server. MAX_CREDIT only bounds a single send (a bug, a typo), not a day.
   */
  | { type: 'CREDIT'; amount: number };

/** The most seeds one CREDIT may add (a whole day of check-ins earns less). */
export const MAX_CREDIT = 100;

export type GardenError = PlacementError | CareError | PurchaseError | PotError | DecorError | PostNoteError | 'NOT_FOUND' | 'NOT_YOURS';

/** What a command made, besides the new state: the plant planted, the seeds earned, the potted item. */
export interface CommandResult {
  object?: GardenObject;
  earned?: number;
  itemId?: string;
}

/** A command's answer without the state: what it made, or why not. */
export type CommandAnswer = { ok: true; result: CommandResult } | { ok: false; error: GardenError };

export type CommandOutcome = { state: GardenState } & CommandAnswer;

/** A station's state as the API hands it out: with its version and the server's clock (growth, thirst and caps run on it). */
export interface GardenView {
  version: number;
  state: GardenState;
  serverTime: string;
}

/** The API's answer to a command: always with the latest state, so even a refusal brings the client up to date. */
export type CommandReply = GardenView & CommandAnswer;

/** Seeds `actorId` has earned from care today. */
export function earnedToday(state: Pick<GardenState, 'earnings'>, actorId: string, now: number): number {
  const e = state.earnings[actorId];
  return e && e.day === careDay(now) ? e.amount : 0;
}

/**
 * Apply one command to a station's state. Pure: the time and new ids come in, so the server
 * and the browser get the same answer. The input state is never modified.
 */
export function runCommand(state: GardenState, cmd: GardenCommand, actor: Actor, now: number, newId: () => string): CommandOutcome {
  const at = new Date(now).toISOString();
  const ok = (changes: Partial<GardenState>, result: CommandResult = {}): CommandOutcome => ({ ok: true, state: { ...state, ...changes }, result });
  const no = (error: GardenError): CommandOutcome => ({ ok: false, error, state });
  const decor = (change: DecorChange): CommandOutcome => (change.ok ? ok(change.state) : no(change.error));

  switch (cmd.type) {
    case 'PLANT': {
      const packet = seedItemId(cmd.itemType);
      const error = validatePlacement(cmd.itemType, cmd.x, cmd.y, state.objects, owned(state.inventory, packet));
      if (error) return no(error);
      const object: GardenObject = {
        id: newId(),
        gardenId: state.gardenId,
        type: getCatalogItem(cmd.itemType)!.type,
        itemType: cmd.itemType,
        x: cmd.x,
        y: cmd.y,
        createdAt: at,
        placedBy: actor.id,
        placedByName: actor.name,
      };
      return ok({ objects: [...state.objects, object], inventory: consume(state.inventory, packet) }, { object });
    }
    case 'CARE': {
      const plant = state.objects.find((o) => o.id === cmd.plantId);
      if (!plant) return no('NOT_FOUND');
      const already = earnedToday(state, actor.id, now);
      const check = checkCare(plant, cmd.action, now, { fertilizer: owned(state.inventory, FERTILIZER), earnedToday: already });
      if (!check.ok) return no(check.error!);
      const object = cmd.action === 'HARVEST' ? null : applyCare(plant, cmd.action, now, actor);
      return ok(
        {
          objects: object ? state.objects.map((o) => (o.id === plant.id ? object : o)) : state.objects.filter((o) => o.id !== plant.id),
          balance: state.balance + check.reward,
          inventory: check.uses ? consume(state.inventory, check.uses) : state.inventory,
          earnings: { ...state.earnings, [actor.id]: { day: careDay(now), amount: already + check.reward } },
        },
        { earned: check.reward },
      );
    }
    case 'BUY': {
      const bought = applyPurchase(state, cmd.itemId, actor, at);
      return bought.ok ? ok(bought.state) : no(bought.error);
    }
    case 'POT': {
      const potted = potPlant(state, cmd.plantId, now);
      return potted.ok ? ok(potted.state, { itemId: potted.itemId }) : no(potted.error);
    }
    case 'PLACE_DECOR':
      return decor(placeDecor(state, cmd.itemId, cmd.room, cmd.x, cmd.y, actor, at, newId()));
    case 'MOVE_DECOR':
      return decor(moveDecor(state, cmd.decorId, cmd.x, cmd.y));
    case 'WATER_DECOR':
      return decor(waterDecor(state, cmd.decorId, actor, at));
    case 'PUT_AWAY_DECOR':
      return decor(putAwayDecor(state, cmd.decorId));
    case 'POST_NOTE': {
      const error = checkPostNote(cmd.content, owned(state.inventory, POST_IT));
      if (error) return no(error);
      const note: SocialNote = { id: newId(), authorId: actor.id, content: noteText(cmd.content), createdAt: at };
      return ok({ notes: [...state.notes, note], inventory: consume(state.inventory, POST_IT) });
    }
    case 'TAKE_DOWN_NOTE': {
      const note = state.notes.find((n) => n.id === cmd.noteId);
      if (!note) return no('NOT_FOUND');
      if (!canTakeDown(note, actor.id)) return no('NOT_YOURS');
      return ok({ notes: state.notes.filter((n) => n.id !== note.id) });
    }
    case 'CREDIT':
      return ok({ balance: state.balance + Math.min(MAX_CREDIT, Math.max(0, Math.floor(cmd.amount))) });
  }
}

/**
 * A new station's garden: 20 seeds, the starter inventory, and a demo garden of every
 * species with delivered art (credited to whoever opened it first), so there's something to tend.
 */
export function newGarden(gardenId: string, by: Actor, now: number, newId: () => string): GardenState {
  const ago = (sec: number) => new Date(now - sec * 1000).toISOString();
  const hourAgo = ago(3600);
  /** `watered`: watered an hour ago (wet soil); otherwise thirsty. `pruned` too: every need met, so it shines. */
  const mk = (itemType: string, x: number, y: number, watered = false, pruned = false, plantedSecAgo = 24 * 3600): GardenObject => ({
    id: newId(),
    gardenId,
    type: 'PLANT',
    itemType,
    x,
    y,
    createdAt: ago(plantedSecAgo),
    placedBy: by.id,
    placedByName: by.name,
    ...(watered && {
      care: {
        boostMs: 0,
        lastWateredAt: hourAgo,
        ...(pruned && { lastPrunedAt: hourAgo }),
        log: [
          ...(pruned ? [{ action: 'PRUNE' as const, by: by.id, byName: by.name, at: hourAgo }] : []),
          { action: 'WATER' as const, by: by.id, byName: by.name, at: hourAgo },
        ],
      },
    }),
  });
  return {
    gardenId,
    balance: 20,
    earnings: {},
    inventory: { ...STARTER_INVENTORY },
    purchases: [],
    notes: [],
    decorations: [],
    objects: [
      // Top field
      mk('lily', 2, 5, true),
      mk('rose', 5, 5, true),
      mk('pitcher', 8, 5, true, true),
      mk('lettuce', 15, 5),
      mk('fern', 18, 5, true),
      mk('nopal', 21, 5, true),
      // Bottom field
      mk('cempasuchil', 2, 11, true),
      mk('yellowflower', 5, 11, true, true),
      mk('mustard', 8, 11),
      mk('monstera', 5, 13, true, true),
      mk('tulip', 8, 13, true),
      // Rose bushes planted 0s, 45s, 95s and 160s ago: one per growth stage, all blooming within minutes.
      ...[0, 45, 95, 160].map((sec, i) => mk('rose', 14 + 2 * i, 12, true, false, sec)),
    ],
  };
}
