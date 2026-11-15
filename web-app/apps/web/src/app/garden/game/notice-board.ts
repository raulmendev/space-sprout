import { makeCanvas } from './placeholders';

/**
 * Message board geometry, in sprite pixels at 1x (1 tile = 32px): where notes are pinned on
 * the delivered board's cork (14,14 · 86×58), and placeholder art for the notes and bubble.
 *
 * The board is one sprite; each note is its own small sprite pinned on top, so the art
 * team draws one board and a few notes instead of a board per note count.
 */
/** Size of the delivered board art (social/board/prop-message-board.png): stands on its 4×2-tile footprint. */
export const BOARD_SIZE: [number, number] = [114, 104];

export const NOTE_SIZE = 24;

/** The "new note" bubble's bottom-centre: on the frame's top-right corner, clear of the HUD. */
export const BUBBLE_AT = { dx: 102, dy: 12 } as const;

/** Centres of the six note slots (3 × 2) on the cork, each with a slight hand-pinned tilt. */
export const NOTE_SLOTS = [
  { dx: 28, dy: 28, angle: -6 },
  { dx: 57, dy: 27, angle: 4 },
  { dx: 86, dy: 29, angle: -3 },
  { dx: 29, dy: 57, angle: 5 },
  { dx: 57, dy: 58, angle: -4 },
  { dx: 85, dy: 56, angle: 3 },
] as const;

// Placeholder palette (canvas can't read CSS variables): the theme's bark-dark, alert, parchment and cream.
const INK = '#4a3222';
const ALERT = '#d6453d';
const PARCHMENT = '#f3e2c3';
const CREAM = '#fbf3e4';
export const NOTE_COLORS = { astronaut: '#a9dcf2', family: '#ffe27a' } as const;

// ---------------------------------------------------------------- placeholder art

/** One square sticky note with a pin. */
export function stickyNoteArt(color: string): HTMLCanvasElement {
  const [canvas, ctx] = makeCanvas(NOTE_SIZE);
  paper(ctx, 2, 3, color);
  pin(ctx, 12, 5);
  return canvas;
}

/** The overflow note: a little stack with a "+", shown when there are more notes than slots. */
export function noteStackArt(): HTMLCanvasElement {
  const [canvas, ctx] = makeCanvas(NOTE_SIZE);
  paper(ctx, 4, 1, PARCHMENT, false);
  paper(ctx, 1, 4, CREAM, false);
  ctx.fillStyle = INK;
  ctx.fillRect(10, 9, 3, 11);
  ctx.fillRect(6, 13, 11, 3);
  pin(ctx, 11, 6);
  return canvas;
}

/** Floating "new note" bubble above the board (same family as the plant thirst bubble). */
export function noteBubbleArt(): HTMLCanvasElement {
  const [canvas, ctx] = makeCanvas(32);
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.roundRect(3, 3, 26, 20, 6);
  ctx.moveTo(12, 22);
  ctx.lineTo(16, 29);
  ctx.lineTo(20, 22);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.roundRect(5, 5, 22, 16, 5);
  ctx.moveTo(14, 20);
  ctx.lineTo(16, 25);
  ctx.lineTo(18, 20);
  ctx.fill();
  // A tiny yellow note inside the bubble.
  ctx.fillStyle = INK;
  ctx.fillRect(10, 7, 12, 12);
  ctx.fillStyle = NOTE_COLORS.family;
  ctx.fillRect(11, 8, 10, 10);
  ctx.fillStyle = ALERT;
  ctx.fillRect(15, 7, 2, 2);
  return canvas;
}

function paper(ctx: CanvasRenderingContext2D, x: number, y: number, color: string, lines = true): void {
  const s = 20;
  ctx.fillStyle = INK;
  ctx.fillRect(x - 1, y - 1, s + 2, s + 2);
  ctx.fillStyle = color;
  ctx.fillRect(x, y, s, s);
  ctx.fillStyle = 'rgb(0 0 0 / 0.12)'; // folded bottom-right corner
  ctx.fillRect(x + s - 5, y + s - 5, 5, 5);
  if (!lines) return;
  ctx.fillStyle = 'rgb(74 50 34 / 0.35)';
  for (const ly of [8, 12, 16]) ctx.fillRect(x + 3, y + ly, ly === 16 ? 9 : 14, 1);
}

function pin(ctx: CanvasRenderingContext2D, cx: number, cy: number): void {
  ctx.fillStyle = INK;
  ctx.fillRect(cx - 2, cy - 2, 5, 5);
  ctx.fillStyle = ALERT;
  ctx.fillRect(cx - 1, cy - 1, 3, 3);
  ctx.fillStyle = '#ffb3ad';
  ctx.fillRect(cx - 1, cy - 1, 1, 1);
}
