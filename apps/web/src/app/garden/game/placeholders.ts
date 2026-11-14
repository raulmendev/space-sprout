/**
 * PLACEHOLDER art, generated at the agreed native sizes. The design team's
 * final PNGs replace these via the asset manifest — see asset-registry.ts.
 * Intentionally simple: do not invest in polishing anything here.
 */

const SPRITE_PX = 16;
const TILE_PX = 32;

const PALETTE: Record<string, string> = {
  K: '#2b2238', // outline
  G: '#6abe30', // leaf
  D: '#37946e', // dark leaf / stem
  L: '#99e550', // light leaf
  Y: '#fbd23a', // yellow
  O: '#e58a2b', // orange
  B: '#8f563b', // brown
  b: '#663931', // dark brown
  P: '#d76fae', // pink
  p: '#f6b4d8', // light pink
  R: '#d04b4b', // red
  W: '#ffffff',
  c: '#f5dfb5', // cream (npc body)
  s: '#f19ab5', // blush
  V: '#2d4f7c', // visor
  v: '#8fc4f0', // visor glint
  g: '#8a8f9c', // boots
};

type Grid = readonly string[];

export const SEED: Grid = [
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '......BBBB......',
  '.....BbYYbB.....',
  '....BBBBBBBB....',
  '................',
  '................',
  '................',
];

export const SPROUT: Grid = [
  '................',
  '................',
  '................',
  '................',
  '................',
  '....LL....LL....',
  '...LGGL..LGGL...',
  '...LGGGLLGGGL...',
  '....LGGDDGGL....',
  '.......DD.......',
  '.......DD.......',
  '.......DD.......',
  '.....BBDDBB.....',
  '....BbbbbbbB....',
  '................',
  '................',
];

const FLOWER: Grid = [
  '................',
  '................',
  '......PPPP......',
  '.....PppppP.....',
  '....PppYYppP....',
  '....PpYOOYpP....',
  '....PpYOOYpP....',
  '....PppYYppP....',
  '.....PppppP.....',
  '......PPPP......',
  '.......DD.......',
  '....LL.DD.LL....',
  '....LGGDDGGL....',
  '.....LGDDGL.....',
  '.....BBDDBB.....',
  '....BbbbbbbB....',
];

const SUNFLOWER: Grid = [
  '......YYYY......',
  '....YYOYYOYY....',
  '...YOYbbbbYOY...',
  '...YYbBbBbbYY...',
  '...YYbbBbBbYY...',
  '...YOYbbbbYOY...',
  '....YYOYYOYY....',
  '......YYYY......',
  '.......DD.......',
  '...LLL.DD.......',
  '...LGGGDD.......',
  '.......DD.LLL...',
  '.......DDGGGL...',
  '.......DD.......',
  '.....BBDDBB.....',
  '....BbbbbbbB....',
];

const TREE: Grid = [
  '................',
  '.....DDDDDD.....',
  '...DDGGGGGGDD...',
  '..DGGGLGGGGGGD..',
  '.DGGLLGGGGRGGGD.',
  '.DGGGGGGGGGGGGD.',
  '.DGGGGRGGGGLGGD.',
  '.DDGGGGGGGGGGDD.',
  '..DDGGGGRGGGDD..',
  '...DDDGGGGDDD...',
  '.....DDbBDD.....',
  '.......bB.......',
  '.......bB.......',
  '......bbBB......',
  '.....BbbbbBB....',
  '................',
];

export const NPC_SPROUT: Grid = [
  '.......LL.......',
  '......LGGL.LL...',
  '.......LGLLGGL..',
  '........DD......',
  '.....KKKKKK.....',
  '....KccccccK....',
  '...KccccccccK...',
  '...KcKccccKcK...',
  '...KcKccccKcK...',
  '...KsccKKccsK...',
  '...KccccccccK...',
  '....KccccccK....',
  '.....KKKKKK.....',
  '....KcK..KcK....',
  '....KKK..KKK....',
  '................',
];

export const ASTRONAUT: Grid = [
  '................',
  '.....KKKKKK.....',
  '....KWWWWWWK....',
  '...KWWVVVVWWK...',
  '...KWVvvVVVWK...',
  '...KWVVVVVVWK...',
  '....KWWWWWWK....',
  '...KKWWWWWWKK...',
  '..KWWWWRRWWWWK..',
  '..KWWKWWWWKWWK..',
  '..KWWKWWWWKWWK..',
  '..KKKKWWWWKKKK..',
  '....KWWKKWWK....',
  '....KWWKKWWK....',
  '....KggKKggK....',
  '....KKKKKKKK....',
];

export const HINT_PLUS: Grid = [
  '................',
  '................',
  '................',
  '................',
  '......KKKK......',
  '......KWWK......',
  '......KWWK......',
  '...KKKKWWKKKK...',
  '...KWWWWWWWWK...',
  '...KWWWWWWWWK...',
  '...KKKKWWKKKK...',
  '......KWWK......',
  '......KWWK......',
  '......KKKK......',
  '................',
  '................',
];

export const MATURE_GRIDS: Record<string, Grid> = { flower: FLOWER, sunflower: SUNFLOWER, tree: TREE };

function drawGrid(ctx: CanvasRenderingContext2D, grid: Grid, scale: number): void {
  grid.forEach((row, y) => {
    for (let x = 0; x < SPRITE_PX; x++) {
      const color = PALETTE[row[x] ?? '.'];
      if (!color) continue;
      ctx.fillStyle = color;
      ctx.fillRect(x * scale, y * scale, scale, scale);
    }
  });
}

export function makeCanvas(w: number, h = w): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  return [canvas, ctx];
}

export function gridToCanvas(grid: Grid, scale = 2): HTMLCanvasElement {
  const [canvas, ctx] = makeCanvas(SPRITE_PX * scale);
  drawGrid(ctx, grid, scale);
  return canvas;
}

// ---------- Procedural ground tiles (seeded so they look identical every load) ----------

function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

function speckle(base: string, specks: [string, number][], seed: number): HTMLCanvasElement {
  const [canvas, ctx] = makeCanvas(TILE_PX);
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, TILE_PX, TILE_PX);
  const rand = rng(seed);
  for (let y = 0; y < SPRITE_PX; y++) {
    for (let x = 0; x < SPRITE_PX; x++) {
      const r = rand();
      let acc = 0;
      for (const [color, p] of specks) {
        acc += p;
        if (r < acc) {
          ctx.fillStyle = color;
          ctx.fillRect(x * 2, y * 2, 2, 2);
          break;
        }
      }
    }
  }
  return canvas;
}

export function grassTile(seed: number, flowers: boolean): HTMLCanvasElement {
  const canvas = speckle('#8cc269', [['#74ad57', 0.12], ['#a6d67e', 0.08]], seed);
  if (flowers) {
    const ctx = canvas.getContext('2d')!;
    const rand = rng(seed + 99);
    for (let i = 0; i < 3; i++) {
      const fx = 2 + Math.floor(rand() * 12);
      const fy = 2 + Math.floor(rand() * 12);
      ctx.fillStyle = i % 2 ? '#ffffff' : '#f6c945';
      ctx.fillRect(fx * 2, fy * 2, 2, 2);
    }
  }
  return canvas;
}

export function soilTile(seed: number): HTMLCanvasElement {
  const canvas = speckle('#8b5a3c', [['#7a4d33', 0.15], ['#a06a48', 0.08]], seed);
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#6e4530';
  for (const row of [3, 8, 13]) ctx.fillRect(2, row * 2, TILE_PX - 4, 2);
  // soft rim so the plot reads as a raised bed
  ctx.fillStyle = 'rgba(255,255,255,0.10)';
  ctx.fillRect(0, 0, TILE_PX, 2);
  ctx.fillStyle = 'rgba(0,0,0,0.15)';
  ctx.fillRect(0, TILE_PX - 2, TILE_PX, 2);
  return canvas;
}

export function pathTile(seed: number): HTMLCanvasElement {
  return speckle('#dcc79c', [['#c7ad7f', 0.14], ['#ecdcb8', 0.1]], seed);
}

export function hedgeTile(seed: number): HTMLCanvasElement {
  const canvas = speckle('#3f7d4a', [['#2f6139', 0.22], ['#5a9e5a', 0.16]], seed);
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  ctx.fillRect(0, 0, TILE_PX, 4);
  return canvas;
}

export function wetSoilTile(seed: number): HTMLCanvasElement {
  const canvas = speckle('#6b4530', [['#5b3825', 0.18], ['#7b5035', 0.08], ['#8a6a58', 0.02]], seed);
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#4a2e1f';
  for (const row of [3, 8, 13]) ctx.fillRect(2, row * 2, TILE_PX - 4, 2);
  return canvas;
}

export function woodPathTile(): HTMLCanvasElement {
  const [canvas, ctx] = makeCanvas(TILE_PX);
  const seams = [10, 26, 4, 18];
  for (let i = 0; i < 4; i++) {
    const y = i * 8;
    ctx.fillStyle = i % 2 ? '#a56f44' : '#b0784a';
    ctx.fillRect(0, y, TILE_PX, 8);
    ctx.fillStyle = '#c58c5a';
    ctx.fillRect(0, y, TILE_PX, 1);
    ctx.fillStyle = '#6e4529';
    ctx.fillRect(0, y + 7, TILE_PX, 1);
    ctx.fillRect(seams[i], y, 1, 8);
  }
  return canvas;
}

/** Flat tile with an optional repeating pattern. Seamless by construction. */
function flatTile(base: string, draw?: (ctx: CanvasRenderingContext2D) => void): HTMLCanvasElement {
  const [canvas, ctx] = makeCanvas(TILE_PX);
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, TILE_PX, TILE_PX);
  draw?.(ctx);
  return canvas;
}

export const TILE_PLACEHOLDERS: Record<string, () => HTMLCanvasElement> = {
  WALL: () => flatTile('#4b5266', (c) => {
    c.fillStyle = '#5c6479';
    c.fillRect(0, 0, 32, 2);
  }),
  WALL_FACE: () => flatTile('#8d96ab', (c) => {
    c.fillStyle = '#7a8398';
    c.fillRect(0, 28, 32, 4);
    c.fillRect(15, 0, 1, 28);
  }),
  WINDOW: () => flatTile('#8d96ab', (c) => {
    c.fillStyle = '#1d1b3a';
    c.fillRect(5, 5, 22, 19);
    c.fillStyle = '#ffffff';
    for (const [x, y] of [[9, 9], [20, 12], [13, 18], [23, 20]]) c.fillRect(x, y, 1, 1);
    c.fillStyle = '#7a8398';
    c.fillRect(0, 28, 32, 4);
  }),
  WINDOW_EARTH_L: () => flatTile('#8d96ab', (c) => {
    c.fillStyle = '#1d1b3a';
    c.fillRect(5, 5, 27, 19);
    c.fillStyle = '#3f6db0';
    c.beginPath();
    c.arc(32, 22, 12, Math.PI, 1.5 * Math.PI);
    c.lineTo(32, 22);
    c.fill();
    c.fillStyle = '#7a8398';
    c.fillRect(0, 28, 32, 4);
  }),
  WINDOW_EARTH_R: () => flatTile('#8d96ab', (c) => {
    c.fillStyle = '#1d1b3a';
    c.fillRect(0, 5, 27, 19);
    c.fillStyle = '#3f6db0';
    c.beginPath();
    c.arc(0, 22, 12, 1.5 * Math.PI, 2 * Math.PI);
    c.lineTo(0, 22);
    c.fill();
    c.fillStyle = '#5fae5a';
    c.fillRect(2, 14, 4, 3);
    c.fillStyle = '#7a8398';
    c.fillRect(0, 28, 32, 4);
  }),
  GLASS_PARTITION: () => flatTile('#a9d6e0', (c) => {
    c.fillStyle = '#7fb3c2';
    c.fillRect(14, 0, 4, 32);
    c.fillStyle = 'rgba(255,255,255,0.6)';
    c.fillRect(6, 4, 2, 10);
  }),
  DOORWAY: () => flatTile('#9aa3b3', (c) => {
    c.fillStyle = '#b6bdca';
    for (let y = 2; y < 32; y += 6) c.fillRect(0, y, 32, 2);
  }),
  LOW_WALL: () => flatTile('#c8b8a0', (c) => {
    c.fillStyle = '#e5d8c2';
    c.fillRect(0, 0, 32, 10);
    c.fillStyle = '#a8977e';
    c.fillRect(0, 30, 32, 2);
  }),
  FLOOR_MEDICAL: () => flatTile('#dbe8f2', (c) => {
    c.fillStyle = '#c3d6e6';
    c.fillRect(0, 0, 32, 1);
    c.fillRect(0, 0, 1, 32);
  }),
  FLOOR_SOCIAL: () => flatTile('#c99a6b', (c) => {
    c.fillStyle = '#b8895c';
    for (const y of [7, 15, 23, 31]) c.fillRect(0, y, 32, 1);
    c.fillRect(12, 0, 1, 8);
    c.fillRect(26, 8, 1, 8);
    c.fillRect(6, 16, 1, 8);
    c.fillRect(20, 24, 1, 8);
  }),
  RUG: () => flatTile('#c9b6e4', (c) => {
    c.fillStyle = '#b9a3d9';
    for (let i = 0; i < 32; i += 8) c.fillRect(i, i, 4, 4);
  }),
};

/** Labelled 3/4 box: the stand-in for every interactive object and decoration. */
export function labelledBox(w: number, h: number, colors: { top: string; front: string; ink: string }, label: string, badge?: string): HTMLCanvasElement {
  const [canvas, ctx] = makeCanvas(w, h);
  const topH = Math.round(h * 0.35);
  const r = 4;
  ctx.fillStyle = colors.front;
  ctx.beginPath();
  ctx.roundRect(1, 1, w - 2, h - 2, r);
  ctx.fill();
  ctx.fillStyle = colors.top;
  ctx.beginPath();
  ctx.roundRect(1, 1, w - 2, topH, [r, r, 0, 0]);
  ctx.fill();
  ctx.strokeStyle = colors.ink;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(1, 1, w - 2, h - 2, r);
  ctx.stroke();
  ctx.fillStyle = colors.ink;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const words = label.split(' ');
  const size = w >= 64 ? 9 : 7;
  ctx.font = `bold ${size}px sans-serif`;
  const lines = w >= 64 ? [label] : words;
  lines.forEach((line, i) => ctx.fillText(line, w / 2, topH + (h - topH) / 2 + (i - (lines.length - 1) / 2) * (size + 1), w - 4));
  if (badge) {
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(w - 9, 9, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = colors.ink;
    ctx.font = 'bold 10px sans-serif';
    ctx.fillText(badge, w - 9, 9.5);
  }
  return canvas;
}

/** Draw a 16x16 grid scaled into a canvas of any size, anchored bottom-centre. */
export function gridInCanvas(grid: Grid, scale: number, w: number, h: number): HTMLCanvasElement {
  const [canvas, ctx] = makeCanvas(w, h);
  ctx.drawImage(gridToCanvas(grid, scale), (w - SPRITE_PX * scale) / 2, h - SPRITE_PX * scale);
  return canvas;
}

/** 64x96 tree: the 16px grid at 4x on top of a longer trunk. */
export function tallTree(): HTMLCanvasElement {
  const [canvas, ctx] = makeCanvas(64, 96);
  ctx.fillStyle = '#663931';
  ctx.fillRect(28, 56, 4, 36);
  ctx.fillStyle = '#8f563b';
  ctx.fillRect(32, 56, 4, 36);
  ctx.fillRect(22, 90, 20, 6);
  ctx.drawImage(gridToCanvas(TREE, 4), 0, 0);
  return canvas;
}

/** Shown when a manifest-listed PNG fails to load: obvious, never a crash. */
export function missingTexture(w: number, h: number): HTMLCanvasElement {
  const [canvas, ctx] = makeCanvas(w, h);
  for (let y = 0; y < h; y += 8) {
    for (let x = 0; x < w; x += 8) {
      ctx.fillStyle = (x + y) % 16 ? '#ff00ff' : '#1a1a1a';
      ctx.fillRect(x, y, 8, 8);
    }
  }
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 12px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('?', w / 2, h / 2);
  return canvas;
}
