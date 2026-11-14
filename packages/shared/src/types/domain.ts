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
}

export type PlantStage = 'SEED' | 'SPROUT' | 'MATURE';

export type HealthMetric = 'HEART_RATE' | 'WEIGHT' | 'WELLBEING';
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

export interface RewardTransaction {
  id: string;
  gardenId: string;
  measurementId: string;
  amount: number;
  createdAt: string;
}

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
  | { type: 'EMOTE_AREA_SELECTED' }
  | { type: 'TILE_SELECTED'; x: number; y: number }
  | { type: 'PROP_SELECTED'; propId: string }
  | { type: 'NPC_SELECTED' };

export type PropInteraction = Extract<
  HabitatInteraction,
  { type: 'MEDICAL_TERMINAL_SELECTED' | 'HEALTH_INSIGHTS_SELECTED' | 'MESSAGE_BOARD_SELECTED' | 'EMOTE_AREA_SELECTED' }
>['type'];

export type MedicalTerminalState = 'idle' | 'syncing' | 'complete' | 'attention';
export type InsightsDisplayState = 'idle' | 'new_data' | 'active';
export type MessageBoardState = 'idle' | 'unread';

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

export interface SocialEmote {
  id: string;
  authorId: string;
  emote: string;
  createdAt: string;
}
