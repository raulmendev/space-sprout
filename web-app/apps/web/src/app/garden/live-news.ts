import { type GardenObject, type PlacedDecor, describeItem, getCatalogItem } from '@garden/shared';
import type { GardenNews } from './live-channel';

const CARE_VERB = { WATER: 'watered', FERTILIZE: 'fertilized', PRUNE: 'pruned', HARVEST: 'harvested' } as const;

/**
 * Someone else's change in one line, e.g. "Mom watered the mustard." `objects` and `decorations`
 * are the garden as it was just before (a harvested plant is gone afterwards).
 */
export function describeNews({ by, command }: GardenNews, objects: readonly GardenObject[], decorations: readonly PlacedDecor[]): string {
  const plant = (id: string) => plantName(objects.find((o) => o.id === id)?.itemType);
  const decor = (id: string) => describeItem(decorations.find((d) => d.id === id)?.itemId ?? '').name.toLowerCase() || 'decoration';
  const did = (() => {
    switch (command.type) {
      case 'PLANT':
        return `planted ${withArticle(plantName(command.itemType))}`;
      case 'CARE':
        return `${CARE_VERB[command.action]} the ${plant(command.plantId)}`;
      case 'BUY':
        return `bought ${withArticle(describeItem(command.itemId).name.toLowerCase())} 🛒`;
      case 'POT':
        return `potted the ${plant(command.plantId)}`;
      case 'PLACE_DECOR':
        return `put up ${withArticle(describeItem(command.itemId).name.toLowerCase())}`;
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
      case 'CREDIT':
        return `earned 🌱 ${command.amount} with a health check-in`;
    }
  })();
  return `${by.name} ${did}.`;
}

const plantName = (itemType: string | undefined) => (getCatalogItem(itemType ?? '')?.name ?? 'plant').toLowerCase();
const withArticle = (noun: string) => `${/^[aeiou]/.test(noun) ? 'an' : 'a'} ${noun}`;
