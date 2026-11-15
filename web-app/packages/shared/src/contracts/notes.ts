/**
 * Message board rules. Notes are written on post-its, which are bought with seeds into a
 * stock shared by the whole habitat; pinning a note uses one.
 */
export const NOTE_RULES = {
  /** Longest note, in characters. */
  maxLength: 280,
  /** Seeds per post-it. */
  postItPrice: 3,
  /** How many post-its the shop's pack holds. */
  packSize: 5,
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

/** Why a note can't be pinned, or null. Pinning uses one post-it from the shared stock. */
export function checkPostNote(content: string, postIts: number): PostNoteError | null {
  if (!noteText(content)) return 'EMPTY_NOTE';
  return postIts < 1 ? 'OUT_OF_POST_ITS' : null;
}

export type PostItError = 'INVALID_QUANTITY' | 'INSUFFICIENT_FUNDS';

export function postItCost(quantity: number): number {
  return quantity * NOTE_RULES.postItPrice;
}

/** Why buying `quantity` post-its isn't possible with this balance, or null. */
export function checkPostItPurchase(quantity: number, balance: number): PostItError | null {
  if (!Number.isInteger(quantity) || quantity < 1) return 'INVALID_QUANTITY';
  return balance < postItCost(quantity) ? 'INSUFFICIENT_FUNDS' : null;
}
