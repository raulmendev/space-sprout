import type { Actor } from '../types/domain';
import type { GardenCommand, GardenState } from './garden';

/**
 * The live channel (a WebSocket at /api/live). The browser's first message is its session
 * token (browsers can't set headers on a WebSocket, and a token in the URL ends up in logs).
 */
export type LiveClientMessage = { type: 'AUTH'; token: string };

export type LiveServerMessage =
  /** Signed in: changes to this station will follow. */
  | { type: 'READY'; serverTime: string }
  /** Someone in the station changed the garden: its whole new state, so a missed message can't leave anyone behind. */
  | { type: 'GARDEN'; version: number; state: GardenState; serverTime: string; by: Actor; command: GardenCommand }
  /** The token was refused: sign in again. */
  | { type: 'DENIED' };

/** Close code for a refused or missing token (the 4000s are the app's own). */
export const LIVE_DENIED = 4401;
