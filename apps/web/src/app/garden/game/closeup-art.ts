/**
 * High-detail (64x64) pixel art for the plant close-up view.
 *
 * Drawn procedurally with a tiny pixel painter: shaded ellipses lit from the
 * top-left, curved stems, and a selective dark outline. Rendering only.
 */
import type { PlantStage } from '@garden/shared';

type Ramp = readonly [dark: string, mid: string, light: string, highlight: string];

const RAMPS = {
  leaf: ['#1e5a3c', '#2f8a4a', '#5cb84a', '#a6e06a'],
  stem: ['#1e5a3c', '#2e7d3e', '#4fa04a', '#86cc5e'],
  canopy: ['#1b4d36', '#2c7845', '#4fa34a', '#94d468'],
  pink: ['#a03c78', '#d464a2', '#f29cc8', '#ffd8ec'],
  yellow: ['#c27a14', '#eba625', '#fcd23c', '#fff3a6'],
  amber: ['#9a5212', '#cf7d1c', '#eda830', '#f8cf5a'],
  seedhead: ['#2e1a12', '#4e2e1c', '#6e4428', '#946238'],
  bark: ['#3a2216', '#5a3824', '#7f5238', '#a5734e'],
  soil: ['#3c2417', '#5b3825', '#7b5035', '#9a6a45'],
  red: ['#7a1f2a', '#bf3540', '#e65c5a', '#ffb8a8'],
  seed: ['#4a2e16', '#7a5228', '#b0803e', '#e2bf82'],
  stone: ['#5c5866', '#85808f', '#aaa5b3', '#d4d0dc'],
  charcoal: ['#1d1822', '#36303e', '#575062', '#857d90'],
} satisfies Record<string, Ramp>;

const LIGHT = (() => {
  const l = [-0.5, -0.7, 0.6];
  const n = Math.hypot(...l);
  return l.map((v) => v / n) as [number, number, number];
})();

function shadeIndex(nx: number, ny: number): number {
  const nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
  const v = LIGHT[0] * nx + LIGHT[1] * ny + LIGHT[2] * nz;
  return v > 0.85 ? 3 : v > 0.45 ? 2 : v > 0 ? 1 : 0;
}

function mix(a: string, b: string, t: number): string {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const ch = (p: number, s: number) => (p >> s) & 255;
  const c = (s: number) => Math.round(ch(pa, s) * (1 - t) + ch(pb, s) * t);
  return `#${((c(16) << 16) | (c(8) << 8) | c(0)).toString(16).padStart(6, '0')}`;
}

type Pt = readonly [number, number];

class Pix {
  private readonly data: (string | null)[];

  constructor(
    readonly w: number,
    readonly h: number,
  ) {
    this.data = new Array(w * h).fill(null);
  }

  set(x: number, y: number, c: string): void {
    x = Math.round(x);
    y = Math.round(y);
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    this.data[y * this.w + x] = c;
  }

  /** Shaded, optionally rotated ellipse. `rib` draws a leaf vein along the long axis. */
  ellipse(cx: number, cy: number, rx: number, ry: number, angle: number, ramp: Ramp, opts: { rib?: boolean } = {}): void {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const r = Math.ceil(Math.max(rx, ry)) + 1;
    for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) {
      for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
        const dx = x + 0.5 - cx;
        const dy = y + 0.5 - cy;
        const u = (dx * cos + dy * sin) / rx;
        const v = (-dx * sin + dy * cos) / ry;
        const d2 = u * u + v * v;
        if (d2 > 1) continue;
        let idx = shadeIndex(u * cos - v * sin, u * sin + v * cos);
        if (d2 > 0.8) idx = Math.max(0, idx - 1); // soft rim defines overlapping shapes
        if (opts.rib && Math.abs(v) < 0.2 && Math.abs(u) < 0.8) idx = idx >= 2 ? 1 : 2;
        this.set(x, y, ramp[idx]);
      }
    }
  }

  disc(cx: number, cy: number, r: number, ramp: Ramp): void {
    this.ellipse(cx, cy, r, r, 0, ramp);
  }

  /** Quadratic-bezier stem, `half` pixels either side of the centre line. */
  stem(p0: Pt, p1: Pt, p2: Pt, half: number, ramp: Ramp): void {
    for (let i = 0; i <= 80; i++) {
      const t = i / 80;
      const a = (1 - t) * (1 - t);
      const b = 2 * (1 - t) * t;
      const c = t * t;
      const x = a * p0[0] + b * p1[0] + c * p2[0];
      const y = a * p0[1] + b * p1[1] + c * p2[1];
      for (let k = -half; k <= half; k++) {
        const idx = half === 0 ? 2 : k === -half ? 3 : k === half ? 1 : 2;
        this.set(x + k, y, ramp[idx]);
      }
    }
  }

  /** Speckle texture inside a disc (e.g. sunflower seeds). */
  texture(cx: number, cy: number, r: number, ramp: Ramp): void {
    for (let y = Math.floor(cy - r); y <= cy + r; y++) {
      for (let x = Math.floor(cx - r); x <= cx + r; x++) {
        if ((x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2 > (r - 1) ** 2) continue;
        if ((x * 3 + y * 5) % 7 === 0) this.set(x, y, ramp[3]);
        else if ((x * 5 + y * 3) % 7 === 0) this.set(x, y, ramp[0]);
      }
    }
  }

  /** Selective outline: empty pixels touching a shape take a darkened version of it. */
  outline(): this {
    const src = [...this.data];
    const at = (x: number, y: number) => (x < 0 || y < 0 || x >= this.w || y >= this.h ? null : src[y * this.w + x]);
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        if (src[y * this.w + x]) continue;
        const n = at(x, y + 1) ?? at(x - 1, y) ?? at(x + 1, y) ?? at(x, y - 1);
        if (n) this.data[y * this.w + x] = mix(n, '#2b2238', 0.6);
      }
    }
    return this;
  }

  toDataUrl(): string {
    const canvas = document.createElement('canvas');
    canvas.width = this.w;
    canvas.height = this.h;
    const ctx = canvas.getContext('2d')!;
    this.data.forEach((c, i) => {
      if (!c) return;
      ctx.fillStyle = c;
      ctx.fillRect(i % this.w, Math.floor(i / this.w), 1, 1);
    });
    return canvas.toDataURL();
  }
}

// ---------------------------------------------------------------- plants
// Canvas is 64x64; the plant's base sits at the bottom centre (32, 63).

function drawSeed(p: Pix, itemType: string): void {
  if (itemType === 'tree') {
    p.ellipse(32, 58, 3.5, 4.5, 0, RAMPS.seed);
    p.ellipse(32, 54.5, 4.5, 2.2, 0, RAMPS.bark);
    p.set(32, 51.5, RAMPS.bark[1]);
  } else if (itemType === 'sunflower') {
    p.ellipse(32, 58, 2.6, 5, 0.25, RAMPS.charcoal);
    for (let y = 55; y <= 61; y++) p.set(32 + (y - 58) * 0.25, y, RAMPS.charcoal[3]);
  } else {
    p.ellipse(32, 59, 3.4, 2.6, -0.4, RAMPS.seed);
  }
}

function drawSprout(p: Pix, itemType: string): void {
  if (itemType === 'tree') {
    p.stem([32, 63], [32, 52], [33, 40], 0, RAMPS.bark);
    p.stem([33, 47], [35, 45], [37, 42], 0, RAMPS.bark);
    p.ellipse(38, 42, 4, 2, -0.5, RAMPS.canopy, { rib: true });
    p.ellipse(29, 38, 5, 2.5, 0.6, RAMPS.canopy, { rib: true });
    p.ellipse(37, 37, 5, 2.5, -0.6, RAMPS.canopy, { rib: true });
    p.ellipse(33, 34, 2.5, 4.5, 0.1, RAMPS.canopy);
  } else if (itemType === 'sunflower') {
    p.stem([32, 63], [32, 48], [32, 36], 1, RAMPS.stem);
    p.ellipse(27, 52, 5, 2.2, 0.5, RAMPS.leaf, { rib: true });
    p.ellipse(37, 54, 5, 2.2, -0.5, RAMPS.leaf, { rib: true });
    p.ellipse(25, 37, 8, 3.5, 0.35, RAMPS.leaf, { rib: true });
    p.ellipse(39, 36, 8, 3.5, -0.35, RAMPS.leaf, { rib: true });
  } else {
    p.stem([32, 63], [31, 52], [33, 43], 0, RAMPS.stem);
    p.ellipse(26.5, 41, 7, 3, 0.45, RAMPS.leaf, { rib: true });
    p.ellipse(38.5, 40, 7, 3, -0.45, RAMPS.leaf, { rib: true });
  }
}

function petalRing(p: Pix, c: Pt, n: number, offset: number, rx: number, ry: number, phase: number, ramp: Ramp): void {
  const petals = Array.from({ length: n }, (_, i) => phase + (i * Math.PI * 2) / n);
  petals.sort((a, b) => Math.sin(a) - Math.sin(b)); // back (top) petals first
  for (const a of petals) {
    p.ellipse(c[0] + Math.cos(a) * offset, c[1] + Math.sin(a) * offset * 0.92, rx, ry, a, ramp);
  }
}

function drawMature(p: Pix, itemType: string): void {
  if (itemType === 'tree') {
    p.ellipse(32, 62, 6, 2, 0, RAMPS.bark);
    p.stem([32, 63], [31, 50], [32, 34], 2, RAMPS.bark);
    p.stem([31, 46], [26, 40], [22, 32], 0, RAMPS.bark);
    p.stem([33, 44], [38, 38], [42, 30], 0, RAMPS.bark);
    for (const [x, y, r] of [
      [20, 28, 9],
      [44, 27, 9],
      [32, 26, 13],
      [25, 17, 9],
      [39, 16, 9],
      [32, 12, 7],
    ] as const) {
      p.disc(x, y, r, RAMPS.canopy);
    }
    for (const [x, y] of [
      [23, 30],
      [41, 24],
      [30, 33],
      [46, 33],
      [35, 17],
      [20, 20],
    ] as const) {
      p.disc(x, y, 2.3, RAMPS.red);
    }
  } else if (itemType === 'sunflower') {
    p.stem([32, 63], [33, 44], [32, 26], 1, RAMPS.stem);
    p.ellipse(22, 50, 10, 4.2, 0.4, RAMPS.leaf, { rib: true });
    p.ellipse(42, 42, 10, 4.2, -0.4, RAMPS.leaf, { rib: true });
    p.ellipse(24, 36, 7, 3, 0.5, RAMPS.leaf, { rib: true });
    const head: Pt = [32, 19];
    petalRing(p, head, 14, 11.5, 5, 2.4, Math.PI / 14, RAMPS.amber);
    petalRing(p, head, 14, 10, 5.5, 2.6, 0, RAMPS.yellow);
    p.disc(head[0], head[1], 8, RAMPS.seedhead);
    p.texture(head[0], head[1], 8, RAMPS.seedhead);
  } else {
    p.stem([32, 63], [28, 44], [32, 26], 0, RAMPS.stem);
    p.ellipse(25, 49, 8, 3.2, 0.5, RAMPS.leaf, { rib: true });
    p.ellipse(39, 45, 8, 3.2, -0.5, RAMPS.leaf, { rib: true });
    p.stem([31, 48], [38, 40], [41, 35], 0, RAMPS.stem);
    p.ellipse(41, 32, 2.5, 3.5, 0.3, RAMPS.pink);
    const center: Pt = [32, 20];
    petalRing(p, center, 6, 7, 6, 4.2, -Math.PI / 2 + 0.2, RAMPS.pink);
    p.disc(center[0], center[1], 4.5, RAMPS.yellow);
    p.texture(center[0], center[1], 4.5, RAMPS.amber);
  }
}

const cache = new Map<string, string>();

/** Data URL of the 64x64 close-up art for a plant at a given stage. */
export function closeupPlantArt(itemType: string, stage: PlantStage): string {
  const key = `${itemType}:${stage}`;
  let url = cache.get(key);
  if (!url) {
    const p = new Pix(64, 64);
    if (stage === 'SEED') drawSeed(p, itemType);
    else if (stage === 'SPROUT') drawSprout(p, itemType);
    else drawMature(p, itemType);
    url = p.outline().toDataUrl();
    cache.set(key, url);
  }
  return url;
}

/** Data URL of the 80x24 soil mound the plant stands in. */
export function closeupSoilArt(): string {
  let url = cache.get('soil');
  if (!url) {
    const p = new Pix(80, 24);
    p.ellipse(40, 15, 34, 8, 0, RAMPS.soil);
    p.disc(22, 13, 1.6, RAMPS.stone);
    p.disc(57, 16, 1.3, RAMPS.stone);
    p.disc(47, 11, 1, RAMPS.stone);
    for (const [x, a] of [
      [9, -0.3],
      [12, 0.2],
      [70, 0.3],
      [67, -0.2],
    ] as const) {
      p.ellipse(x, 10, 1.4, 5, a, RAMPS.leaf);
    }
    url = p.outline().toDataUrl();
    cache.set('soil', url);
  }
  return url;
}

/** Art geometry, so the view can line plant and soil up at an integer scale. */
export const CLOSEUP_GEOMETRY = { plantPx: 64, soilW: 80, soilH: 24, plantBaseInSoil: 8 } as const;
