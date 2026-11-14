/**
 * Fixed 12x12 garden layout.
 *  H = hedge (border)   . = grass   , = grass with flowers
 *  S = soil plot (plantable)   P = path
 */
export const GRID_SIZE = 12;

export const GARDEN_LAYOUT: readonly string[] = [
  'HHHHHHHHHHHH',
  'H..,....,..H',
  'H.SSS..SSS.H',
  'H.SSS..SSS.H',
  'H.SSS..SSS.H',
  'H....PP....H',
  'HPPPPPPPPPPH',
  'H....PP..,.H',
  'H.SSS..SSS.H',
  'H.SSS..SSS.H',
  'H..,.PP....H',
  'HHHHHPPHHHHH',
];

export type TileKind = 'HEDGE' | 'GRASS' | 'GRASS_FLOWERS' | 'SOIL' | 'PATH';

const KIND_BY_CHAR: Record<string, TileKind> = {
  H: 'HEDGE',
  '.': 'GRASS',
  ',': 'GRASS_FLOWERS',
  S: 'SOIL',
  P: 'PATH',
};

export function getTileKind(x: number, y: number): TileKind | undefined {
  const ch = GARDEN_LAYOUT[y]?.[x];
  return ch === undefined ? undefined : KIND_BY_CHAR[ch];
}

/** Fixed tile where the NPC stands. */
export const NPC_TILE = { x: 7, y: 5 } as const;
