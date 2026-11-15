/**
 * Emotes a player can send from the HUD: a quick feeling shown in a bubble over their character.
 * Cooperative and kind only. Ids are what a server would relay to the other players in the room.
 */
export const EMOTES = [
  { id: 'LOVE', glyph: '💚', label: 'Love' },
  { id: 'HAPPY', glyph: '😊', label: 'Happy' },
  { id: 'HELLO', glyph: '👋', label: 'Hello' },
  { id: 'ENCOURAGE', glyph: '🌱', label: 'Encouragement' },
  { id: 'CELEBRATE', glyph: '⭐', label: 'Celebration' },
  { id: 'HUG', glyph: '🤗', label: 'Hug' },
  { id: 'YES', glyph: '✅', label: 'Yes' },
  { id: 'NO', glyph: '❌', label: 'No' },
] as const;

export type EmoteId = (typeof EMOTES)[number]['id'];

/** How long an emote stays over its character, in ms. */
export const EMOTE_MS = 3000;

export function emoteGlyph(id: EmoteId): string {
  return EMOTES.find((e) => e.id === id)!.glyph;
}
