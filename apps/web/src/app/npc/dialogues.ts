import type { Dialogue, DialogueTrigger } from '@garden/shared';

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

export function dialoguesFor(trigger: DialogueTrigger): Dialogue[] {
  return DIALOGUES.filter((d) => d.trigger === trigger);
}
