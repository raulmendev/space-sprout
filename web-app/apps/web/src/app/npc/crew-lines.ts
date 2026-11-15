import type { CrewId, HealthMetric, UserRole } from '@garden/shared';

/**
 * What the crew say. Each speaks in their own voice about the readings that fit
 * their job (see CREW in @garden/shared). Several variants per moment, so a daily
 * check-in doesn't sound like a form. Replies are keyed by the reading's band
 * (CHECKIN_BANDS): encouraging, never clinical.
 */

/** Opening line before the first question of the day. */
export const INTRO: Record<CrewId, readonly string[]> = {
  MEDIC: [
    "Hi! How are you? I'm going to ask you a few things about your day.",
    'Hello again! Mind if I ask a few things about your day?',
    'There you are! Quick check-up, it only takes a minute.',
  ],
  TRAINER: [
    "Hey, champ! Let's see how your training's going.",
    'Coach here! Two quick questions and you can go.',
    'Ready for your check-in? Shoulders back!',
  ],
  CHEF: [
    'Ah, just who I wanted to see! Let me ask about your diet.',
    'Hello, dear! Before you go, let me ask about food and water.',
    "Last but not least: what you're eating and drinking!",
  ],
  SCIENTIST: [
    'Okay, let me check the radiation and the environment.',
    'Hold still a moment: time for my daily readings.',
    "Perfect timing! The sensors are warmed up. Let's take your base levels.",
  ],
};

/** The question for each reading. */
export const ASK: Record<HealthMetric, readonly string[]> = {
  MOOD: ['First things first: how are you feeling today?', 'How are you feeling right now?'],
  SLEEP: [
    'How are you sleeping? How many hours did you get last night?',
    "Let's talk sleep. How many hours last night?",
  ],
  BODY_TEMP: [
    'Do you know what your body temperature was today?',
    'Did you take your temperature today? What did it say?',
  ],
  HEART_RATE: [
    'Next, what about your heart rate? Your resting pulse, in beats per minute.',
    "And your heart rate? What's your resting pulse?",
  ],
  ACTIVITY: [
    'All right, have you done exercise today? How many minutes?',
    'Did you move today? Treadmill, bike, weights… how many minutes?',
  ],
  STRESS: [
    "Now let's see your level of stress. How do you feel?",
    "How's your stress today? Be honest with your coach.",
  ],
  CALORIES: [
    'What did you eat today? Roughly how many calories?',
    'How many calories did you eat today?',
  ],
  WATER: [
    'And what about water? How many litres today?',
    'Staying hydrated? How much water have you had today?',
  ],
  // The scientist reads these himself; this is what he says before the scan.
  RADIATION: ['Ready? Hold still while I scan.'],
  CO2: ['Ready? Hold still while I scan.'],
};

/** Reply after an answer, by reading and band (UNKNOWN = "I don't know"). */
export const REPLY: Partial<Record<HealthMetric, Record<string, readonly string[]>>> = {
  MOOD: {
    LOW: ["Thanks for telling me. Go easy on yourself today.", "I hear you. If you want to talk, my door's open."],
    OKAY: ['Okay is okay. Thanks for checking in.', 'Steady days count too.'],
    GOOD: ["Love to hear it!", "That's what I like to see!"],
  },
  SLEEP: {
    BAD: ['Hope you sleep better next time.', 'Rough night? Try dimming the lights a little earlier tonight.'],
    REGULAR: ['Good, keep sleeping like that.', "Not bad! A little more wouldn't hurt."],
    GOOD: ['Yay! Solid rest.', 'Yay! Your body thanks you.'],
    GREAT: ['Yippee!! Fully recharged.', 'Yippee!! Textbook sleep.'],
  },
  BODY_TEMP: {
    BAD: ["Ow… we've got to check that. Take it again later, okay?", "Hmm, that's off. Measure again in a bit and come see me."],
    GOOD: ['Good! But it can be great.', 'Close to perfect. Keep an eye on it.'],
    GREAT: ["Right where it should be. You're in great shape!", 'Perfect. Just what I like to see.'],
    UNKNOWN: ['Well, next time check it. Okay?', "No worries. There's a thermometer in the med bay for next time."],
  },
  HEART_RATE: {
    LOW: ['Oh no! Check your numbers! Measure again at rest.', "That's low. Check your numbers again, and tell me if you feel dizzy."],
    REGULAR: ['Great!', 'Great! Steady as a metronome.'],
    HIGH: ['Jeez! Check your numbers! Sit down a minute and measure again.', "That's high. Take a few slow breaths and check it again."],
    UNKNOWN: ['Keep the record, please!', 'The wearable can keep the record for you. Try it next time!'],
  },
  ACTIVITY: {
    YES: ['Yippee! Keep going!', "That's what I'm talking about! Your bones and muscles thank you."],
    LITTLE: ["That's all right. Every minute counts.", 'A little bit is still a win!'],
    NOPE: ["Next time it'll be. I'll save you a spot on the bike.", 'Rest day? Fine. Tomorrow we move!'],
  },
  STRESS: {
    LOW: ['Yeah… flow like your plants.', 'Calm as the garden. Love it.'],
    MODERATE: ['Nice! Keep it right there.', 'Right in the sweet spot. Keep it there.'],
    OPTIMAL: ['Great, but it can be MORE great.', 'Focused and ready! Just remember to rest.'],
    HIGH: ["Oh… let's calm down a little bit. Shoulders down, slow breath.", "Let's bring it down a notch. A short walk in the garden helps."],
    TOO_HIGH: [
      "Breathe with me: in, 1, 2, 3… out, 1, 2, 3… Again.",
      'Stop for a moment. Breathe in, 1, 2, 3… and out, 1, 2, 3. Better?',
    ],
  },
  CALORIES: {
    LOW: ["You need to eat more. I'll save you a plate!", "That's a light day. Come by the galley, there's soup."],
    JUST_RIGHT: ['Exactly what you need!', "Perfect portions. Chef's kiss!"],
    HIGH: ['Oh! A little more than you need. Lighter dinner tonight?', 'A hearty day! Maybe go easy on dessert.'],
  },
  WATER: {
    LOW: ['Your plants drink more than that! Grab a pouch.', 'A bit more water, please. Up here, thirst fools you.'],
    JUST_RIGHT: ["Great, now you're ready!", 'Perfectly hydrated. Well done!'],
    HIGH: ["Wow! That's plenty. You can ease off a little.", 'Wow, a lot of water! No need to go past 4 litres.'],
  },
};

/** Replies for the family, at home on Earth, where the station's version doesn't fit (EARTH_BANDS). */
export const EARTH_REPLY: Partial<Record<HealthMetric, Record<string, readonly string[]>>> = {
  WATER: {
    LOW: ['Your plants drink more than that! Grab a glass of water.', 'A bit more water, please. Keep a bottle nearby.'],
    JUST_RIGHT: ['Nicely hydrated. Well done!', 'Just right! Your body thanks you.'],
    HIGH: ["Wow, that's plenty! You can ease off a little.", "That's a lot of water! No need to overdo it."],
  },
};

/** The reply for an answer, as said to this role. */
export function replyLines(metric: HealthMetric, band: string, role: UserRole): readonly string[] | undefined {
  return (role === 'FAMILY' ? EARTH_REPLY[metric]?.[band] : undefined) ?? REPLY[metric]?.[band];
}

/** Crew with nothing to ask this player (the scientist, for the family): a friendly hello instead. */
export const NOTHING_TO_ASK: Record<CrewId, readonly string[]> = {
  MEDIC: ['Hello! Nothing to check with you right now. Take care!'],
  TRAINER: ['Hey there! Nothing to log with me. Keep moving!'],
  CHEF: ['Hello, dear! Nothing to ask you today.'],
  SCIENTIST: [
    "Hello from the lab! Radiation and cabin air are the station's business, so no scan for you.",
    "Nice to see you here! My sensors only watch the station's air. You're all set.",
  ],
};

/** How the scientist describes each level after his scan. */
export const SCAN_NOTE: Partial<Record<HealthMetric, Record<string, string>>> = {
  RADIATION: { LOW: 'nice and low', NORMAL: 'normal for orbit', HIGH: 'a bit high; stay near the shielded module today' },
  CO2: { FRESH: 'fresh air', FINE: 'just fine', HIGH: "high; I'll tune the scrubbers" },
};

/** The scientist's scan, out loud. `{rad}`, `{radNote}`, `{co2}`, `{co2Note}` are filled in. */
export const SCAN_RESULT: readonly string[] = [
  'Beep… beep… beep… Wow! Look: radiation is at {rad} ({radNote}), and the air has {co2} of CO₂ ({co2Note}).',
  'Beep… beep… beep… Got it! Radiation: {rad}, {radNote}. CO₂: {co2}, {co2Note}.',
];

/** When you put a question off ("Later" or ✕): no pressure, but don't forget the Medical Station. */
export const LATER: Record<CrewId, readonly string[]> = {
  MEDIC: [
    "Okay! When you have a minute, come by the Medical Station to finish your check-in.",
    "No rush. You'll find me at the Medical Station when you're ready.",
  ],
  TRAINER: [
    'No problem! Swing by the Medical Station later and get it logged.',
    "Busy, huh? Don't skip it: stop by the Medical Station later.",
  ],
  CHEF: [
    "Of course, dear. Stop by the Medical Station when you're ready.",
    "Off you go! Just don't forget the Medical Station later.",
  ],
  SCIENTIST: [
    'Fine, fine. Remember to visit the Medical Station later.',
    "Later, then. The Medical Station will be waiting for you.",
  ],
};

/** Said once everything of theirs is answered today. */
export const ALL_DONE: Record<CrewId, readonly string[]> = {
  MEDIC: ["You're all checked in with me today. Take care!", "That's everything from me today. Rest well!"],
  TRAINER: ['Your training is logged for today. Keep it up!', "You're done with me today. Don't forget to stretch!"],
  CHEF: ["Your diet's logged for today. There's more in the galley!", 'All set with me today. Dinner is at seven!'],
  SCIENTIST: ["Today's readings are in. Thanks for keeping the record!", 'All scanned for today. The station looks good!'],
};

/** One of a line's variants. */
export function pick(lines: readonly string[]): string {
  return lines[Math.floor(Math.random() * lines.length)];
}
