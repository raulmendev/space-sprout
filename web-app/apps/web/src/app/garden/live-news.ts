import { type CareAction, type GardenObject, type PlacedDecor, describeItem, labelText, plantName } from '@garden/shared';
import { t } from '../i18n/i18n';
import { seeds } from '../shared/format';
import type { GardenNews } from './live-channel';

/** "{who} watered {what}." for each care action. */
const CARED: Record<CareAction, string> = {
  WATER: '{who} watered {what}.',
  FERTILIZE: '{who} fertilized {what}.',
  PRUNE: '{who} pruned {what}.',
  HARVEST: '{who} harvested {what}.',
};

/**
 * Someone else's change in one line, e.g. "Mom watered the mustard." `objects` and `decorations`
 * are the garden as it was just before (a harvested plant is gone afterwards).
 */
export function describeNews({ by, command }: GardenNews, objects: readonly GardenObject[], decorations: readonly PlacedDecor[]): string {
  const plant = (id: string) => plantName(objects.find((o) => o.id === id)?.itemType ?? 'plant');
  const item = (itemId: string) => describeItem(itemId).name.toLowerCase() || 'decoration';
  const decor = (id: string) => item(decorations.find((d) => d.id === id)?.itemId ?? '');
  const who = by.name;
  switch (command.type) {
    case 'PLANT':
      return t('{who} planted {what}.', { who, what: a(plantName(command.itemType)) });
    case 'CARE':
      return t(CARED[command.action], { who, what: the(plant(command.plantId)) });
    case 'BUY':
      return t('{who} bought {what} 🛒.', { who, what: a(item(command.itemId)) });
    case 'POT':
      return t('{who} potted {what}.', { who, what: the(plant(command.plantId)) });
    case 'LABEL': {
      const name = labelText(command.text);
      const what = the(plant(command.plantId));
      return name ? t('{who} named {what} “{name}” 🏷️.', { who, what, name }) : t('{who} took the label off {what}.', { who, what });
    }
    case 'PLACE_DECOR':
      return t('{who} put up {what}.', { who, what: a(item(command.itemId)) });
    case 'MOVE_DECOR':
      return t('{who} moved {what}.', { who, what: the(decor(command.decorId)) });
    case 'WATER_DECOR':
      return t('{who} watered {what}.', { who, what: the(decor(command.decorId)) });
    case 'PUT_AWAY_DECOR':
      return t('{who} put away {what}.', { who, what: the(decor(command.decorId)) });
    case 'POST_NOTE':
      return t('{who} pinned a note on the board 📌.', { who });
    case 'TAKE_DOWN_NOTE':
      return t('{who} took a note down.', { who });
    case 'REWARD':
      return t('{who} earned {seeds} 🌱 with a health check-in.', { who, seeds: seeds(command.amount) });
  }
}

/** "a mustard", "an orange tulip" (Spanish: "una mostaza", "un tulipán naranja"). */
const a = (noun: string) => t(`${/^[aeiou]/.test(noun) ? 'an' : 'a'} ${noun}`);
/** "the mustard" (Spanish: "la mostaza"). */
const the = (noun: string) => t(`the ${noun}`);
