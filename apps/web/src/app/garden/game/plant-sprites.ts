/**
 * Original pixel-art sprites, defined as 16x16 character grids and rendered
 * at 2x to 32x32 tiles. No external assets needed.
 *
 * Rendering-only module: shared by Phaser (textures) and Angular (icons).
 */
import type { PlantStage, TileKind } from '@garden/shared';

export const SPRITE_PX = 16;
export const TILE_PX = 32;

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
};

type Grid = readonly string[];

const SEED: Grid = [
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

const SPROUT: Grid = [
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

const NPC_SPROUT: Grid = [
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

const HINT_PLUS: Grid = [
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

export const HINT_TEXTURE = 'hint-plus';

const MATURE: Record<string, Grid> = { flower: FLOWER, sunflower: SUNFLOWER, tree: TREE };

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

function makeCanvas(size: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
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

function grassTile(seed: number, flowers: boolean): HTMLCanvasElement {
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

function soilTile(seed: number): HTMLCanvasElement {
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

function pathTile(seed: number): HTMLCanvasElement {
  return speckle('#dcc79c', [['#c7ad7f', 0.14], ['#ecdcb8', 0.1]], seed);
}

function hedgeTile(seed: number): HTMLCanvasElement {
  const canvas = speckle('#3f7d4a', [['#2f6139', 0.22], ['#5a9e5a', 0.16]], seed);
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  ctx.fillRect(0, 0, TILE_PX, 4);
  return canvas;
}

// ---------- Texture keys ----------

export const NPC_TEXTURE = 'npc-sprout';
export const TILE_VARIANTS = 4;

export function tileTextureKey(kind: TileKind, x: number, y: number): string {
  return `tile-${kind}-${(x * 7 + y * 13) % TILE_VARIANTS}`;
}

export function plantTextureKey(itemType: string, stage: PlantStage): string {
  if (stage === 'SEED') return 'plant-seed';
  if (stage === 'SPROUT') return 'plant-sprout';
  return MATURE[itemType] ? `plant-${itemType}` : 'plant-flower';
}

/** All textures the scene needs, keyed for Phaser's texture manager. */
export function buildAllTextures(): Map<string, HTMLCanvasElement> {
  const out = new Map<string, HTMLCanvasElement>();
  for (let v = 0; v < TILE_VARIANTS; v++) {
    out.set(`tile-GRASS-${v}`, grassTile(11 + v, false));
    out.set(`tile-GRASS_FLOWERS-${v}`, grassTile(31 + v, true));
    out.set(`tile-SOIL-${v}`, soilTile(51 + v));
    out.set(`tile-PATH-${v}`, pathTile(71 + v));
    out.set(`tile-HEDGE-${v}`, hedgeTile(91 + v));
  }
  out.set('plant-seed', gridToCanvas(SEED));
  out.set('plant-sprout', gridToCanvas(SPROUT));
  for (const [id, grid] of Object.entries(MATURE)) out.set(`plant-${id}`, gridToCanvas(grid));
  out.set(NPC_TEXTURE, gridToCanvas(NPC_SPROUT));
  out.set(HINT_TEXTURE, gridToCanvas(HINT_PLUS));
  return out;
}

/** Data URL for use in Angular templates (shop icons, NPC portrait). */
const iconCache = new Map<string, string>();
export function spriteIcon(name: 'npc' | string, scale = 4): string {
  const key = `${name}@${scale}`;
  let url = iconCache.get(key);
  if (!url) {
    const grid = name === 'npc' ? NPC_SPROUT : (MATURE[name] ?? FLOWER);
    url = gridToCanvas(grid, scale).toDataURL();
    iconCache.set(key, url);
  }
  return url;
}
