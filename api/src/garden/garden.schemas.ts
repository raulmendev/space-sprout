import { NOTE_RULES, ROOMS, type RoomId } from '@garden/shared';
import { z } from 'zod';

const id = z.string().min(1).max(64);
const tile = z.number().int().min(0).max(200);
const room = z.enum(Object.keys(ROOMS) as [RoomId, ...RoomId[]]);

/** One command from a player, checked for shape here; the shared rules decide whether it's allowed. */
export const CommandSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('PLANT'), itemType: id, x: tile, y: tile }),
  z.object({ type: z.literal('CARE'), plantId: id, action: z.enum(['WATER', 'FERTILIZE', 'PRUNE', 'HARVEST']) }),
  z.object({ type: z.literal('BUY'), itemId: id }),
  z.object({ type: z.literal('POT'), plantId: id }),
  z.object({ type: z.literal('PLACE_DECOR'), itemId: id, room, x: tile, y: tile }),
  z.object({ type: z.literal('MOVE_DECOR'), decorId: id, x: tile, y: tile }),
  z.object({ type: z.literal('WATER_DECOR'), decorId: id }),
  z.object({ type: z.literal('PUT_AWAY_DECOR'), decorId: id }),
  z.object({ type: z.literal('POST_NOTE'), content: z.string().max(NOTE_RULES.maxLength * 2) }),
  z.object({ type: z.literal('TAKE_DOWN_NOTE'), noteId: id }),
  z.object({ type: z.literal('CREDIT'), amount: z.number().int().min(0) }),
  z.object({ type: z.literal('RESET') }),
]);

/** A command with the id the device gave it (the same id on a retry). */
export const SendCommandSchema = z.object({ id: z.uuid(), command: CommandSchema });
export type SendCommand = z.infer<typeof SendCommandSchema>;
