import { type GardenObject, type PlacedDecor, describeItem, labelText, plantName } from '@garden/shared';
import { seeds } from '../shared/format';
import { CARE_PAST } from './care-labels';
import type { GardenNews } from './live-channel';

/**
 * Someone else's change in one line, e.g. "Mom watered the mustard." `objects` and `decorations`
 * are the garden as it was just before (a harvested plant is gone afterwards).
 */
export function describeNews({ by, command }: GardenNews, objects: readonly GardenObject[], decorations: readonly PlacedDecor[]): string {
  const plant = (id: string) => plantName(objects.find((o) => o.id === id)?.itemType ?? 'plant');
  const item = (itemId: string) => describeItem(itemId).name.toLowerCase() || 'decoration';
  const decor = (id: string) => item(decorations.find((d) => d.id === id)?.itemId ?? '');
  const did = (() => {
    switch (command.type) {
      case 'PLANT':
        return `planted ${withArticle(plantName(command.itemType))}`;
      case 'CARE':
        return `${CARE_PAST[command.action].toLowerCase()} the ${plant(command.plantId)}`;
      case 'BUY':
        return `bought ${withArticle(item(command.itemId))} 🛒`;
      case 'POT':
        return `potted the ${plant(command.plantId)}`;
      case 'LABEL': {
        const name = labelText(command.text);
        return name ? `named the ${plant(command.plantId)} “${name}” 🏷️` : `took the label off the ${plant(command.plantId)}`;
      }
      case 'PLACE_DECOR':
        return `put up ${withArticle(item(command.itemId))}`;
      case 'MOVE_DECOR':
        return `moved the ${decor(command.decorId)}`;
      case 'WATER_DECOR':
        return `watered the ${decor(command.decorId)}`;
      case 'PUT_AWAY_DECOR':
        return `put away the ${decor(command.decorId)}`;
      case 'POST_NOTE':
        return 'pinned a note on the board 📌';
      case 'TAKE_DOWN_NOTE':
        return 'took a note down';
      case 'REWARD':
        return `earned ${seeds(command.amount)} 🌱 with a health check-in`;
    }
  })();
  return `${by.name} ${did}.`;
}

const withArticle = (noun: string) => `${/^[aeiou]/.test(noun) ? 'an' : 'a'} ${noun}`;
