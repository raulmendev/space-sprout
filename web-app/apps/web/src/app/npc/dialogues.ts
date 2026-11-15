import type { Dialogue, DialogueTrigger, PetId } from '@garden/shared';

/**
 * Rabanito, the station radish, is the garden's guide: predefined, deterministic lines.
 * Friendly, brief, never clinical, with a squeak or a wiggle here and there.
 */
const ASK = { label: 'How does it work?', action: 'EXPLAIN' } as const;
export const DIALOGUES: readonly Dialogue[] = [
  {
    id: 'greeting-1',
    trigger: 'GREETING',
    text: 'Squeak! Oh, hello! The garden missed you.',
    actions: [ASK, { label: 'Thanks, Rabanito!', action: 'DISMISS' }],
  },
  {
    id: 'greeting-2',
    trigger: 'GREETING',
    text: "*wiggles its leaves* Just soaking up the sunshine. It's virtual, but it still counts.",
    actions: [ASK, { label: 'Bye for now', action: 'DISMISS' }],
  },
  {
    id: 'greeting-3',
    trigger: 'GREETING',
    text: "*hops in a little circle* Squeak! You're back!",
    actions: [ASK, { label: 'Hi, Rabanito!', action: 'DISMISS' }],
  },
  {
    id: 'greeting-4',
    trigger: 'GREETING',
    text: '*bows so low its leaves flop forward* Welcome to the garden.',
    actions: [ASK, { label: 'Thank you!', action: 'DISMISS' }],
  },
  {
    id: 'greeting-5',
    trigger: 'GREETING',
    text: "*peeks out from behind a plant pot* Oh! It's you. Squeak!",
    actions: [ASK, { label: 'Bye for now', action: 'DISMISS' }],
  },
  {
    id: 'explain-1',
    trigger: 'EXPLAIN',
    text: 'Seeds become sprouts, and sprouts bloom all on their own. Nothing here ever wilts, so no rush. Squeak!',
    actions: [{ label: 'Got it', action: 'DISMISS' }],
  },
  {
    id: 'plant-1',
    trigger: 'PLANT_CREATED',
    text: 'Squeak! A new friend for the garden! Give it a minute and watch it grow.',
  },
  {
    id: 'plant-2',
    trigger: 'PLANT_CREATED',
    text: "*sniffs the soil* Lovely spot for it. I'll keep it company.",
  },
];

/** The pets that only react when you go over (Rabanito talks instead: it's the guide). */
export type ReactingPet = Exclude<PetId, 'RADISH'>;

/** What each of those pets "says" when you go over to it, in turn. */
export const PET_LINES: Record<ReactingPet, readonly string[]> = {
  DOG: [
    'Woof! 🐾',
    '*wags tail so hard the whole dog wiggles*',
    'Arf! (Bolita rolls over for a belly rub.)',
    '*sniffs your boots, then sneezes* Woof!',
    '*brings you a lost sock from the laundry module*',
  ],
  CAT: [
    'Mrrp! 🐾',
    '*purrs and headbutts your glove*',
    '*stretches, yawns, and pretends not to see you*',
    'Meow? (Miso wants the sunny spot by the window.)',
    '*kneads your space suit like a pillow*',
  ],
};

export function dialoguesFor(trigger: DialogueTrigger): Dialogue[] {
  return DIALOGUES.filter((d) => d.trigger === trigger);
}
