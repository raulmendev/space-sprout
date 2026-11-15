/**
 * Message board rules. Notes are written on post-its from the household inventory (bought at
 * the store: see POST_IT in store.ts); pinning a note uses one.
 */
export const NOTE_RULES = {
  /** Longest note, in characters. */
  maxLength: 280,
} as const;

/** Only a note's author can take it down; the post-it isn't refunded. */
export function canTakeDown(note: { authorId: string }, actorId: string): boolean {
  return note.authorId === actorId;
}

export type PostNoteError = 'EMPTY_NOTE' | 'OUT_OF_POST_ITS';

/** The note as it gets pinned: trimmed and cut to the length limit. */
export function noteText(content: string): string {
  return content.trim().slice(0, NOTE_RULES.maxLength);
}

/** Why a note can't be pinned, or null. Pinning uses one post-it from the household inventory. */
export function checkPostNote(content: string, postIts: number): PostNoteError | null {
  if (!noteText(content)) return 'EMPTY_NOTE';
  return postIts < 1 ? 'OUT_OF_POST_ITS' : null;
}
