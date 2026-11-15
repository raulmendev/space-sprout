import type { HabitatInteraction, HabitatZone, PropInteraction } from '../types/domain';
import { TileCoord, TileRect, rectContains } from './geometry';

/**
 * The habitat is a set of single-screen rooms (24x16 tiles = 768x512 px at
 * 32 px/tile). Only the room the local player is in is rendered; rooms connect
 * through doors in their side walls. Each room is one functional zone.
 *
 *  X wall cap      V wall face     O window        E/e Earth window (left/right)
 *  Y glass partition               K doorway       L low wall      H hedge
 *  G grass         , grass+flowers S soil plot     P stone path    D wooden path
 *  M medical floor C social floor  R rug
 */
export const TILE_SIZE = 32;
export const ROOM_COLS = 24;
export const ROOM_ROWS = 16;

/** Rooms and zones are one-to-one. */
export type RoomId = HabitatZone;

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

/** Static habitat objects (not purchasable). Footprint is in tiles, from top-left (x, y). */
export interface HabitatProp extends TileRect {
  id: string;
  kind: string;
  name: string;
  interaction?: PropInteraction;
}

/** A doorway tile and where it leads. Stepping onto it moves you to `to` at `arrive`. */
export interface Door extends TileCoord {
  to: RoomId;
  arrive: TileCoord;
}

export interface Room {
  id: RoomId;
  name: string;
  layout: readonly string[];
  props: readonly HabitatProp[];
  doors: readonly Door[];
}

/** Two-tile door in a side wall (rows 7–8), mapped onto the matching door of the next room. */
function sideDoor(side: 'W' | 'E', to: RoomId): Door[] {
  const x = side === 'W' ? 0 : ROOM_COLS - 1;
  const arriveX = side === 'W' ? ROOM_COLS - 2 : 1;
  return [7, 8].map((y) => ({ x, y, to, arrive: { x: arriveX, y } }));
}

export const ROOMS: Record<RoomId, Room> = {
  GARDEN: {
    id: 'GARDEN',
    name: 'Garden',
    // Two large walkable soil fields either side of a centre path, split by the boardwalk.
    layout: [
      'XXXXXXXXXXXXXXXXXXXXXXXX', // 0
      'XVVOOVVVVEeVVVVOOVVVOVVX', // 1
      'XGGG,GGG,GGPPGG,GGG,GGGX', // 2
      'XSSSSSSSSSSPPSSSSSSSSSSX', // 3
      'XSSSSSSSSSSPPSSSSSSSSSSX', // 4
      'XSSSSSSSSSSPPSSSSSSSSSSX', // 5
      'XSSSSSSSSSSPPSSSSSSSSSSX', // 6
      'XDDDDDDDDDDDDDDDDDDDDDDK', // 7
      'XDDDDDDDDDDDDDDDDDDDDDDK', // 8
      'XSSSSSSSSSSPPSSSSSSSSSSX', // 9
      'XSSSSSSSSSSPPSSSSSSSSSSX', // 10
      'XSSSSSSSSSSPPSSSSSSSSSSX', // 11
      'XSSSSSSSSSSPPSSSSSSSSSSX', // 12
      'XSSSSSSSSSSPPSSSSSSSSSSX', // 13
      'XGGGGG,GGGGPPGGGG,GGG,GX', // 14
      'XXXXXXXXXXXXXXXXXXXXXXXX', // 15
    ],
    // A few pieces, with room between them: soil stays free to plant. The back wall's left half
    // sits under the HUD on phones, so only the low bench goes there. The planter and the arch
    // close the centre path's two dead ends.
    props: [
      { id: 'garden-bench', kind: 'GARDEN_BENCH', name: 'Bench', x: 1, y: 2, w: 3, h: 1 },
      { id: 'vine-planter', kind: 'VINE_PLANTER', name: 'Vine planter', x: 11, y: 2, w: 2, h: 1 },
      { id: 'greenhouse', kind: 'GREENHOUSE', name: 'Greenhouse', x: 14, y: 2, w: 3, h: 1 },
      { id: 'watering-can', kind: 'WATERING_CAN', name: 'Watering station', x: 18, y: 2, w: 2, h: 1 },
      { id: 'vine-arch', kind: 'VINE_ARCH', name: 'Vine arch', x: 11, y: 14, w: 2, h: 1 },
    ],
    doors: sideDoor('E', 'SOCIAL'),
  },
  SOCIAL: {
    id: 'SOCIAL',
    name: 'Social Space',
    layout: [
      'XXXXXXXXXXXXXXXXXXXXXXXX', // 0
      'XVOOVVVVVVVEeVVVVVVVOOVX', // 1
      'XCCCCCCCCCCCCCCCCCCCCCCX', // 2
      'XCCCCCCCCCCCCCCCCCCCCCCX', // 3
      'XCCCCCCCCCCCCCCCCCCCCCCX', // 4
      'XCCCCCCCCCCCCCCCCCCCCCCX', // 5
      'XCCCCCCCCCCCCCCCCCCCCCCX', // 6
      'KCCCCCCCCCCCCCCCCCCCCCCK', // 7
      'KCCCCCCCRRRRRRRRCCCCCCCK', // 8
      'XCCCCCCCRRRRRRRRCCCCCCCX', // 9
      'XCCCCCCCRRRRRRRRCCCCCCCX', // 10
      'XCCCCCCCRRRRRRRRCCCCCCCX', // 11
      'XCCCCCCCRRRRRRRRCCCCCCCX', // 12
      'XCCCCCCCCCCCCCCCCCCCCCCX', // 13
      'XCCCCCCCCCCCCCCCCCCCCCCX', // 14
      'XXXXXXXXXXXXXXXXXXXXXXXX', // 15
    ],
    props: [
      // Top-centre, right of the Earth window: the top-left corner sits under the HUD on phones.
      { id: 'message-board', kind: 'MESSAGE_BOARD', name: 'Message Board', x: 13, y: 2, w: 4, h: 2, interaction: 'MESSAGE_BOARD_SELECTED' },
      { id: 'emote-point', kind: 'EMOTE_POINT', name: 'Emote corner', x: 8, y: 2, w: 2, h: 2, interaction: 'EMOTE_AREA_SELECTED' },
      { id: 'comm-terminal', kind: 'COMM_TERMINAL', name: 'Earth Link', x: 17, y: 2, w: 2, h: 2, interaction: 'MESSAGE_BOARD_SELECTED' },
      { id: 'sofa', kind: 'SOFA', name: 'Sofa', x: 10, y: 6, w: 3, h: 1 },
      { id: 'supply-store', kind: 'SUPPLY_STORE', name: 'Supply Store', x: 20, y: 2, w: 2, h: 2, interaction: 'STORE_SELECTED' },
    ],
    doors: [...sideDoor('W', 'GARDEN'), ...sideDoor('E', 'MEDICAL')],
  },
  MEDICAL: {
    id: 'MEDICAL',
    name: 'Medical Station',
    layout: [
      'XXXXXXXXXXXXXXXXXXXXXXXX', // 0
      'XVVVVVVVOOVVVVVOOVVEeVVX', // 1
      'XMMMMMMMMMMMMMMMMMMMMMMX', // 2
      'XMMMMMMMMMMMMMMMMMMMMMMX', // 3
      'XMMMMMMMMMMMMMMMMMMMMMMX', // 4
      'XMMMMMMMMMMMMMMMMMMMMMMX', // 5
      'XMMMMMMMMMMMMMMMMMMMMMMX', // 6
      'KMMMMMMMMMMMMMMMMMMMMMMX', // 7
      'KMMMMMMMMMMMMMMMMMMMMMMX', // 8
      'XMMMMMMMMMMMMMMMMMMMMMMX', // 9
      'XMMMMMMMMMMMMMMMMMMMMMMX', // 10
      'XMMMMMMMMMMMMMMMMMMMMMMX', // 11
      'XMMMMMMMMMMMMMMMMMMMMMMX', // 12
      'XMMMMMMMMMMMMMMMMMMMMMMX', // 13
      'XMMMMMMMMMMMMMMMMMMMMMMX', // 14
      'XXXXXXXXXXXXXXXXXXXXXXXX', // 15
    ],
    props: [
      { id: 'medical-terminal', kind: 'MEDICAL_TERMINAL', name: 'Medical Terminal', x: 4, y: 2, w: 3, h: 2, interaction: 'MEDICAL_TERMINAL_SELECTED' },
      { id: 'health-insights', kind: 'HEALTH_INSIGHTS', name: 'Health Insights', x: 10, y: 2, w: 3, h: 2, interaction: 'HEALTH_INSIGHTS_SELECTED' },
      { id: 'medical-plant', kind: 'POTTED_PLANT', name: 'Potted plant', x: 2, y: 2, w: 1, h: 1 },
      { id: 'medical-plant-2', kind: 'POTTED_PLANT', name: 'Potted plant', x: 21, y: 13, w: 1, h: 1 },
    ],
    doors: sideDoor('W', 'SOCIAL'),
  },
};

/** The room plants live in. */
export const GARDEN_ROOM: RoomId = 'GARDEN';

export function getTileKind(room: RoomId, x: number, y: number): TileKind | undefined {
  const ch = ROOMS[room].layout[y]?.[x];
  return ch === undefined ? undefined : KIND_BY_CHAR[ch];
}

export function propAtTile(room: RoomId, x: number, y: number): HabitatProp | undefined {
  return ROOMS[room].props.find((p) => rectContains(p, x, y));
}

export function doorAt(room: RoomId, x: number, y: number): Door | undefined {
  return ROOMS[room].doors.find((d) => d.x === x && d.y === y);
}

/** Every prop in the habitat, with the room it's in. */
export const ALL_PROPS: readonly (HabitatProp & { room: RoomId })[] = Object.values(ROOMS).flatMap((r) =>
  r.props.map((p) => ({ ...p, room: r.id })),
);

/** What clicking a prop means: its station interaction, or "look at this decoration". */
export function propInteraction(p: HabitatProp): HabitatInteraction {
  return p.interaction ? { type: p.interaction } : { type: 'PROP_SELECTED', propId: p.id };
}

/** Where the NPC lives and wanders around (centre of a tile, in tile units). */
export const NPC_HOME = { room: 'GARDEN' as RoomId, x: 12, y: 5 };
