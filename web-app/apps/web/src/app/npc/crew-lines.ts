import type { CrewId, HealthMetric } from '@garden/shared';

/** The question for each reading (each is asked by exactly one crew member). Friendly; asking, never judging. */
export const ASK_LINES: Record<HealthMetric, string> = {
  HEART_RATE: "Hi! Haven't seen your heart rate today. What's your resting pulse?",
  SLEEP: 'How long did you sleep last night?',
  MOOD: 'And how are you feeling today?',
  ACTIVITY: 'Hey! Did you get some exercise in today? How many minutes?',
  WATER: 'Staying hydrated? How much water have you had today?',
  RADIATION: "Hello! Mind reading me today's dose from your dosimeter?",
};

/** What each crew member says after an answer, and once everything of theirs is logged. */
export const CREW_LINES: Record<CrewId, { thanks: string; allDone: string }> = {
  MEDIC: { thanks: 'Noted, thank you!', allDone: "You're all checked in with me today. Take care!" },
  TRAINER: { thanks: 'Nice work! Logged.', allDone: 'Your exercise is logged for today. Keep it up!' },
  CHEF: { thanks: 'Lovely, I wrote it down.', allDone: "Your water's logged for today. There's more in the galley!" },
  SCIENTIST: { thanks: 'Thank you, that goes in your exposure record.', allDone: 'Your dose is logged for today. Thanks for keeping the record!' },
};
