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
