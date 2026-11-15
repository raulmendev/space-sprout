import type { Dialogue, DialogueTrigger, PetId } from '@garden/shared';

/** Predefined, deterministic dialogue. Friendly, brief, never clinical. */
export const DIALOGUES: readonly Dialogue[] = [
  {
    id: 'greeting-1',
    trigger: 'GREETING',
    text: "Oh, hello! The garden missed you.",
    actions: [
      { label: 'How does it work?', action: 'EXPLAIN' },
      { label: 'Thanks, Sprout!', action: 'DISMISS' },
    ],
  },
  {
    id: 'explain-1',
    trigger: 'EXPLAIN',
    text: 'Seeds become sprouts, and sprouts bloom all on their own. Nothing here ever wilts, so no rush.',
    actions: [{ label: 'Got it', action: 'DISMISS' }],
  },
  {
    id: 'plant-1',
    trigger: 'PLANT_CREATED',
    text: 'A new friend for the garden! Give it a minute and watch it grow.',
  },
  {
    id: 'plant-2',
    trigger: 'PLANT_CREATED',
    text: "Lovely spot for it. I'll keep it company.",
  },
  {
    id: 'idle-1',
    trigger: 'GREETING',
    text: "Hmm? Just enjoying the sunshine. It's virtual, but it still counts.",
    actions: [
      { label: 'How does it work?', action: 'EXPLAIN' },
      { label: 'Bye for now', action: 'DISMISS' },
    ],
  },
];

/** What each station pet "says" when you go over to it, in turn. */
export const PET_LINES: Record<PetId, readonly string[]> = {
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
  RADISH: [
    'Squeak! 🌱',
    '*wiggles its leaves happily*',
    '*hops in a little circle*',
    '*bows so low its leaves flop forward*',
    '*hides behind a plant pot, then peeks out*',
  ],
};

export function dialoguesFor(trigger: DialogueTrigger): Dialogue[] {
  return DIALOGUES.filter((d) => d.trigger === trigger);
}
