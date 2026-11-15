/** Core domain types shared by web and api. Illustrative MVP contracts. */

export type UserRole = 'ASTRONAUT' | 'FAMILY';

export interface User {
  id: string;
  displayName: string;
  role: UserRole;
}

export interface Garden {
  id: string;
  name: string;
  ownerId: string;
  currencyBalance: number;
}

export type GardenObjectType = 'PLANT' | 'DECORATION';

export interface GardenObject {
  id: string;
  gardenId: string;
  type: GardenObjectType;
  itemType: string;
  x: number;
  y: number;
  /** ISO timestamp. Plant growth is derived from this. */
  createdAt: string;
  placedBy?: string;
  placedByName?: string;
  /** Plants only: care history and the growth it has earned. */
  care?: PlantCare;
}

/** Every stage a plant can have, in growth order. Each species uses a subset (see CatalogItem.growth). */
export const PLANT_STAGE_ORDER = ['SEED', 'SPROUT', 'GROWING', 'BUD', 'MATURE'] as const;
export type PlantStage = (typeof PLANT_STAGE_ORDER)[number];

export type CareAction = 'WATER' | 'FERTILIZE' | 'PRUNE' | 'HARVEST';

/** One care action, kept so both players can see who tended what. */
export interface CareEvent {
  action: CareAction;
  by: string;
  byName: string;
  at: string;
}

export interface PlantCare {
  /** Growth time added by care, in ms. Plants never lose growth. */
  boostMs: number;
  lastWateredAt?: string;
  lastFertilizedAt?: string;
  lastPrunedAt?: string;
  /** Newest first, capped. */
  log: CareEvent[];
}

/** Whoever is acting. Astronaut and family share one garden. */
export interface Actor {
  id: string;
  name: string;
}

/** POC metrics (handoff v3.0 §5). Demonstration metrics, not a mission medical protocol. */
export type HealthMetric =
  | 'HEART_RATE'
  | 'SLEEP'
  | 'ACTIVITY'
  | 'MOOD'
  | 'WATER'
  | 'RADIATION'
  | 'BODY_TEMP'
  | 'STRESS'
  | 'CALORIES'
  | 'CO2';

/** The station crew: NPCs who each look after some of the astronaut's daily readings. */
export type CrewId = 'MEDIC' | 'TRAINER' | 'CHEF' | 'SCIENTIST';
/** The station's pets: they roam like the crew but only react when you go over. */
export type PetId = 'DOG' | 'CAT' | 'RADISH';
/** Every NPC: the pets and the crew. */
export type NpcId = PetId | CrewId;
export type MeasurementSource = 'MANUAL' | 'SIMULATED' | 'DEVICE';

export interface HealthMeasurement {
  id: string;
  userId: string;
  metric: HealthMetric;
  value: number;
  unit: string;
  measuredAt: string;
  source: MeasurementSource;
  isSimulated: boolean;
}

export interface FamilyMessage {
  id: string;
  gardenId: string;
  senderId: string;
  content: string;
  createdAt: string;
}

/** Seeds granted for a health check-in. At most one per measurement (unique measurementId). */
export interface RewardTransaction {
  id: string;
  gardenId: string;
  measurementId: string;
  metric: HealthMetric;
  /** UTC calendar day of the measurement (YYYY-MM-DD), for per-day limits. */
  day: string;
  amount: number;
  createdAt: string;
  /** Why it was paid. Missing on older records, which are all check-ins. */
  reason?: RewardReason;
  /** What a bonus was for, unique per bonus: "goal:WATER:2026-11-15", "streak:2026-11-13:3". */
  ref?: string;
}

export type RewardReason = 'CHECK_IN' | 'GOAL' | 'STREAK';

export type DialogueTrigger =
  | 'GREETING'
  | 'HEALTH_CHECK'
  | 'EXPLAIN'
  | 'PLANT_CREATED'
  | 'MESSAGE_RECEIVED';

export interface DialogueAction {
  label: string;
  action: string;
}

export interface Dialogue {
  id: string;
  trigger: DialogueTrigger;
  text: string;
  actions?: DialogueAction[];
}

// ---------------------------------------------------------------- habitat

/** A continuous point in tile units (e.g. 3.5, 7.25 = middle-left of tile 3,7). */
export interface Point {
  x: number;
  y: number;
}

export type HabitatZone = 'GARDEN' | 'MEDICAL' | 'SOCIAL';

/**
 * Interactions emitted by the renderer. The first six are the agreed contract
 * (handoff v3.0 §8); the last three are additions for tiles, decorations and the NPC.
 */
export type HabitatInteraction =
  | { type: 'PLANT_SELECTED'; plantId: string }
  | { type: 'PLOT_SELECTED'; x: number; y: number }
  | { type: 'MEDICAL_TERMINAL_SELECTED' }
  | { type: 'HEALTH_INSIGHTS_SELECTED' }
  | { type: 'MESSAGE_BOARD_SELECTED' }
  | { type: 'STORE_SELECTED' }
  | { type: 'TILE_SELECTED'; x: number; y: number }
  | { type: 'PROP_SELECTED'; propId: string }
  | { type: 'NPC_SELECTED'; npcId: NpcId }
  /** A decoration placed in the station. */
  | { type: 'DECOR_SELECTED'; decorId: string };

export type PropInteraction = Extract<
  HabitatInteraction,
  { type: 'MEDICAL_TERMINAL_SELECTED' | 'HEALTH_INSIGHTS_SELECTED' | 'MESSAGE_BOARD_SELECTED' | 'STORE_SELECTED' }
>['type'];

export type MedicalTerminalState = 'idle' | 'syncing' | 'complete' | 'attention';
export type InsightsDisplayState = 'idle' | 'new_data' | 'active';

export interface Footprint {
  w: number;
  h: number;
}

export interface SocialNote {
  id: string;
  authorId: string;
  content: string;
  createdAt: string;
}
