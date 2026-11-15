import type { Actor } from '../types/domain';
import type { EmoteId } from './emotes';
import type { GardenCommand, GardenState } from './garden';
import type { PresenceMember, Stance } from './presence';

/**
 * The live channel (a WebSocket at /api/live). The browser's first message is its session
 * token (browsers can't set headers on a WebSocket, and a token in the URL ends up in logs).
 */
export type LiveClientMessage =
  | { type: 'AUTH'; token: string }
  /** Where I am now (sent as I move, and again after every reconnect). */
  | { type: 'STANCE'; stance: Stance }
  | { type: 'EMOTE'; emote: EmoteId };

/** Someone else in the station, as one of their connections (`peer`): the same member on two devices is two peers. */
export interface Presence {
  peer: string;
  member: PresenceMember;
  stance: Stance;
}

export type LiveServerMessage =
  /** Signed in: changes to this station will follow. `present`: everyone else already in it, where they stand. */
  | { type: 'READY'; serverTime: string; present: Presence[] }
  /** Someone moved (or arrived). */
  | ({ type: 'STANCE' } & Presence)
  | { type: 'EMOTE'; peer: string; emote: EmoteId }
  /** Someone's connection closed: they're gone until they come back. */
  | { type: 'LEFT'; peer: string }
  /** Someone in the station changed the garden: its whole new state, so a missed message can't leave anyone behind. */
  | { type: 'GARDEN'; version: number; state: GardenState; serverTime: string; by: Actor; command: GardenCommand };

/** Close code for a refused, missing, signed-out or expired session: sign in again (the 4000s are the app's own). */
export const LIVE_DENIED = 4401;
