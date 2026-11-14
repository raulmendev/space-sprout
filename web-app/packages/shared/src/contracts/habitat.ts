import type { HabitatInteraction, HabitatZone, PropInteraction } from '../types/domain';
import { TileRect, rectContains } from './geometry';

/**
 * Single 24x16 habitat (768x512 px at 32 px/tile).
 *
 *  X wall cap      V wall face     O window        E/e Earth window (left/right)
 *  Y glass partition               K doorway       L low wall      H hedge
 *  G grass         , grass+flowers S soil plot     P stone path    D wooden path
 *  M medical floor C social floor  R rug
 */
export const TILE_SIZE = 32;
export const HABITAT_COLS = 24;
export const HABITAT_ROWS = 16;

export const HABITAT_LAYOUT: readonly string[] = [
  'XXXXXXXXXXXXXXXXXXXXXXXX', // 0
  'XVOOVVEeVOOVVVVVOVVVOVVX', // 1
  'XG,GGPPGG,GGYMMMMMMMMMMX', // 2
  'XGSSSPPSSSGGYMMMMMMMMMMX', // 3
  'XGSSSPPSSSG,YMMMMMMMMMMX', // 4
  'XGSSSPPSSSGGYMMMMMMMMMMX', // 5
  'XGDDDDDDDDDDKMMMMMMMMMMX', // 6
  'XGSSSPPSSSGGYMMMMMMMMMMX', // 7
  'XGSSSPPSSSGGYMMMMMMMMMMX', // 8
  'XHHHHKKHHHHHLLLLLKKLLLLX', // 9
  'XCCCCCCCCCCCCCCCCCCCCCCX', // 10
  'XCCCCCCCCRRRRRRCCCCCCCCX', // 11
  'XCCCCCCCCRRRRRRCCCCCCCCX', // 12
  'XCCCCCCCCRRRRRRCCCCCCCCX', // 13
  'XCCCCCCCCCCCCCCCCCCCCCCX', // 14
  'XXXXXXXXXXXXXXXXXXXXXXXX', // 15
];

export type TileKind =
  | 'WALL'
  | 'WALL_FACE'
  | 'WINDOW'
  | 'WINDOW_EARTH_L'
  | 'WINDOW_EARTH_R'
  | 'GLASS_PARTITION'
  | 'DOORWAY'
  | 'LOW_WALL'
  | 'HEDGE'
  | 'GRASS'
  | 'GRASS_FLOWERS'
  | 'SOIL'
  | 'PATH_STONE'
  | 'PATH_WOOD'
  | 'FLOOR_MEDICAL'
  | 'FLOOR_SOCIAL'
  | 'RUG';

const KIND_BY_CHAR: Record<string, TileKind> = {
  X: 'WALL',
  V: 'WALL_FACE',
  O: 'WINDOW',
  E: 'WINDOW_EARTH_L',
  e: 'WINDOW_EARTH_R',
  Y: 'GLASS_PARTITION',
  K: 'DOORWAY',
  L: 'LOW_WALL',
  H: 'HEDGE',
  G: 'GRASS',
  ',': 'GRASS_FLOWERS',
  S: 'SOIL',
  P: 'PATH_STONE',
  D: 'PATH_WOOD',
  M: 'FLOOR_MEDICAL',
  C: 'FLOOR_SOCIAL',
  R: 'RUG',
};

export function getTileKind(x: number, y: number): TileKind | undefined {
  const ch = HABITAT_LAYOUT[y]?.[x];
  return ch === undefined ? undefined : KIND_BY_CHAR[ch];
}

export const ZONES: Record<HabitatZone, TileRect & { label: string }> = {
  GARDEN: { x: 1, y: 2, w: 11, h: 7, label: 'Garden' },
  MEDICAL: { x: 13, y: 2, w: 10, h: 7, label: 'Medical Station' },
  SOCIAL: { x: 1, y: 10, w: 22, h: 5, label: 'Social Space' },
};

export function zoneAt(x: number, y: number): HabitatZone | null {
  for (const [zone, r] of Object.entries(ZONES) as [HabitatZone, TileRect][]) {
    if (rectContains(r, x, y)) return zone;
  }
  return null;
}

/** Static habitat objects (not purchasable). Footprint is in tiles, from top-left (x, y). */
export interface HabitatProp extends TileRect {
  id: string;
  kind: string;
  name: string;
  zone: HabitatZone;
  interaction?: PropInteraction;
}

export const HABITAT_PROPS: readonly HabitatProp[] = [
  { id: 'medical-terminal', kind: 'MEDICAL_TERMINAL', name: 'Medical Terminal', zone: 'MEDICAL', x: 14, y: 2, w: 3, h: 2, interaction: 'MEDICAL_TERMINAL_SELECTED' },
  { id: 'health-insights', kind: 'HEALTH_INSIGHTS', name: 'Health Insights', zone: 'MEDICAL', x: 19, y: 2, w: 3, h: 2, interaction: 'HEALTH_INSIGHTS_SELECTED' },
  { id: 'medical-plant', kind: 'POTTED_PLANT', name: 'Potted plant', zone: 'MEDICAL', x: 22, y: 7, w: 1, h: 1 },
  { id: 'message-board', kind: 'MESSAGE_BOARD', name: 'Message Board', zone: 'SOCIAL', x: 2, y: 10, w: 3, h: 2, interaction: 'MESSAGE_BOARD_SELECTED' },
  { id: 'emote-point', kind: 'EMOTE_POINT', name: 'Emote corner', zone: 'SOCIAL', x: 7, y: 10, w: 2, h: 2, interaction: 'EMOTE_AREA_SELECTED' },
  { id: 'sofa', kind: 'SOFA', name: 'Sofa', zone: 'SOCIAL', x: 10, y: 10, w: 3, h: 1 },
  { id: 'comm-terminal', kind: 'COMM_TERMINAL', name: 'Earth Link', zone: 'SOCIAL', x: 19, y: 10, w: 2, h: 2, interaction: 'MESSAGE_BOARD_SELECTED' },
  { id: 'garden-lamp', kind: 'LAMP', name: 'Garden lamp', zone: 'GARDEN', x: 11, y: 2, w: 1, h: 1 },
  { id: 'garden-planter', kind: 'PLANTER', name: 'Planter', zone: 'GARDEN', x: 10, y: 8, w: 1, h: 1 },
  { id: 'watering-can', kind: 'WATERING_CAN', name: 'Watering can', zone: 'GARDEN', x: 11, y: 7, w: 1, h: 1 },
];

export function propAtTile(x: number, y: number): HabitatProp | undefined {
  return HABITAT_PROPS.find((p) => rectContains(p, x, y));
}

/** What clicking a prop means: its station interaction, or "look at this decoration". */
export function propInteraction(p: HabitatProp): HabitatInteraction {
  return p.interaction ? { type: p.interaction } : { type: 'PROP_SELECTED', propId: p.id };
}

/** Fixed spot where the NPC stands (garden). */
export const NPC_RECT: TileRect = { x: 10, y: 5, w: 1, h: 1 };

export function isNpcTile(x: number, y: number): boolean {
  return rectContains(NPC_RECT, x, y);
}
