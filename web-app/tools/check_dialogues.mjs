// Checks that every answer to a crew question gets the right band, seeds and reply line.
// Run from web-app/: `npm run check:dialogues`
//
// It compiles the shared rules and the crew's lines on the fly (no build needed), then:
//  1. checks the answers from the design script, edge by edge (e.g. 2501 kcal → "About 2,500", x3);
//  2. walks every value in each reading's allowed range and checks it lands in a band with a reply;
//  3. checks the answer buttons (stress, mood), "Don't know", and that each reading has one crew owner.
import { createRequire } from 'node:module';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const ts = require('typescript');
const root = join(dirname(fileURLToPath(import.meta.url)), '..');

// ---------------------------------------------------------------- compile
const out = mkdtempSync(join(tmpdir(), 'check-dialogues-'));
const program = ts.createProgram([join(root, '../shared/src/index.ts')], {
  module: ts.ModuleKind.CommonJS,
  target: ts.ScriptTarget.ES2022,
  outDir: join(out, 'shared'),
  skipLibCheck: true,
});
const emitted = program.emit();
const errors = ts.getPreEmitDiagnostics(program).concat(emitted.diagnostics);
if (errors.length) {
  console.error(ts.formatDiagnostics(errors, { getCanonicalFileName: (f) => f, getCurrentDirectory: () => root, getNewLine: () => '\n' }));
  process.exit(1);
}
// crew-lines.ts only imports types from @garden/shared, so it transpiles on its own.
const linesSrc = readFileSync(join(root, 'apps/web/src/app/npc/crew-lines.ts'), 'utf8');
writeFileSync(join(out, 'crew-lines.js'), ts.transpileModule(linesSrc, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText);
const S = require(join(out, 'shared/index.js'));
const L = require(join(out, 'crew-lines.js'));
rmSync(out, { recursive: true, force: true });

// ---------------------------------------------------------------- helpers
let failures = 0;
let checks = 0;
const fail = (msg) => {
  failures++;
  console.error(`  ✗ ${msg}`);
};
const answer = (role, metric, value) => {
  const band = S.bandFor(metric, value, role);
  return { band, pays: S.rewardFor(metric, value, role), lines: band ? L.replyLines(metric, band.id, role) : undefined };
};

// ---------------------------------------------------------------- 1. the design script, edge by edge
// [metric, value, band id, seeds]. Both roles unless a row says otherwise.
const SCRIPT = [
  // Sleep: <5 h x1, 5–6.5 x2, 6.5–7.5 x3, 7.5–9.5 x4, >9.5 x3
  ['SLEEP', 0, 'BAD', 1], ['SLEEP', 4.75, 'BAD', 1], ['SLEEP', 4.99, 'BAD', 1],
  ['SLEEP', 5, 'REGULAR', 2], ['SLEEP', 6, 'REGULAR', 2], ['SLEEP', 6.49, 'REGULAR', 2],
  ['SLEEP', 6.5, 'GOOD', 3], ['SLEEP', 7, 'GOOD', 3], ['SLEEP', 7.49, 'GOOD', 3],
  ['SLEEP', 7.5, 'GREAT', 4], ['SLEEP', 8, 'GREAT', 4], ['SLEEP', 9.49, 'GREAT', 4],
  ['SLEEP', 9.5, 'GOOD', 3], ['SLEEP', 12, 'GOOD', 3], ['SLEEP', 16, 'GOOD', 3],
  // Heart rate: 50–100 x3, otherwise x1
  ['HEART_RATE', 30, 'LOW', 1], ['HEART_RATE', 49, 'LOW', 1], ['HEART_RATE', 49.9, 'LOW', 1],
  ['HEART_RATE', 50, 'REGULAR', 3], ['HEART_RATE', 72, 'REGULAR', 3], ['HEART_RATE', 100, 'REGULAR', 3],
  ['HEART_RATE', 100.5, 'HIGH', 1], ['HEART_RATE', 101, 'HIGH', 1], ['HEART_RATE', 220, 'HIGH', 1],
  // Exercise: 0 x1, 1–29 x2, ≥30 x3
  ['ACTIVITY', 0, 'NOPE', 1], ['ACTIVITY', 1, 'LITTLE', 2], ['ACTIVITY', 12, 'LITTLE', 2], ['ACTIVITY', 29, 'LITTLE', 2],
  ['ACTIVITY', 30, 'YES', 3], ['ACTIVITY', 33, 'YES', 3], ['ACTIVITY', 600, 'YES', 3],
  // Mood: always x3, never judged
  ['MOOD', 1, 'LOW', 3], ['MOOD', 2, 'LOW', 3], ['MOOD', 3, 'OKAY', 3], ['MOOD', 4, 'GOOD', 3], ['MOOD', 5, 'GOOD', 3],
  // Stress: Low/Moderate/Optimal x3, High x2, Too high x1
  ['STRESS', 1, 'LOW', 3], ['STRESS', 2, 'MODERATE', 3], ['STRESS', 3, 'OPTIMAL', 3], ['STRESS', 4, 'HIGH', 2], ['STRESS', 5, 'TOO_HIGH', 1],
  // Astronaut only. Body temperature: 36.1–37.2 °C x3, near it x2, otherwise x1
  ['BODY_TEMP', 34, 'BAD', 1, 'ASTRONAUT'], ['BODY_TEMP', 35.4, 'BAD', 1, 'ASTRONAUT'],
  ['BODY_TEMP', 35.5, 'GOOD', 2, 'ASTRONAUT'], ['BODY_TEMP', 36, 'GOOD', 2, 'ASTRONAUT'],
  ['BODY_TEMP', 36.1, 'GREAT', 3, 'ASTRONAUT'], ['BODY_TEMP', 36.6, 'GREAT', 3, 'ASTRONAUT'], ['BODY_TEMP', 37.2, 'GREAT', 3, 'ASTRONAUT'],
  ['BODY_TEMP', 37.25, 'GOOD', 2, 'ASTRONAUT'], ['BODY_TEMP', 37.3, 'GOOD', 2, 'ASTRONAUT'], ['BODY_TEMP', 37.7, 'GOOD', 2, 'ASTRONAUT'],
  ['BODY_TEMP', 37.8, 'BAD', 1, 'ASTRONAUT'], ['BODY_TEMP', 42, 'BAD', 1, 'ASTRONAUT'],
  // Astronaut only. Calories: 2300–2700 x3, otherwise x2
  ['CALORIES', 0, 'LOW', 2, 'ASTRONAUT'], ['CALORIES', 2299, 'LOW', 2, 'ASTRONAUT'],
  ['CALORIES', 2300, 'JUST_RIGHT', 3, 'ASTRONAUT'], ['CALORIES', 2500, 'JUST_RIGHT', 3, 'ASTRONAUT'], ['CALORIES', 2501, 'JUST_RIGHT', 3, 'ASTRONAUT'],
  ['CALORIES', 2700, 'JUST_RIGHT', 3, 'ASTRONAUT'], ['CALORIES', 2700.5, 'HIGH', 2, 'ASTRONAUT'], ['CALORIES', 2701, 'HIGH', 2, 'ASTRONAUT'],
  ['CALORIES', 8000, 'HIGH', 2, 'ASTRONAUT'],
  // Astronaut. Water: <3.5 L x3, 3.5–4 x4, >4 x2
  ['WATER', 0, 'LOW', 3, 'ASTRONAUT'], ['WATER', 2, 'LOW', 3, 'ASTRONAUT'], ['WATER', 3.49, 'LOW', 3, 'ASTRONAUT'],
  ['WATER', 3.5, 'JUST_RIGHT', 4, 'ASTRONAUT'], ['WATER', 3.6, 'JUST_RIGHT', 4, 'ASTRONAUT'], ['WATER', 4, 'JUST_RIGHT', 4, 'ASTRONAUT'],
  ['WATER', 4.005, 'HIGH', 2, 'ASTRONAUT'], ['WATER', 4.25, 'HIGH', 2, 'ASTRONAUT'], ['WATER', 10, 'HIGH', 2, 'ASTRONAUT'],
  // Family, on Earth. Water: <1.5 L x2, 1.5–3 x3, >3 x2
  ['WATER', 0, 'LOW', 2, 'FAMILY'], ['WATER', 1.49, 'LOW', 2, 'FAMILY'],
  ['WATER', 1.5, 'JUST_RIGHT', 3, 'FAMILY'], ['WATER', 2.1, 'JUST_RIGHT', 3, 'FAMILY'], ['WATER', 3, 'JUST_RIGHT', 3, 'FAMILY'],
  ['WATER', 3.005, 'HIGH', 2, 'FAMILY'], ['WATER', 3.5, 'HIGH', 2, 'FAMILY'], ['WATER', 10, 'HIGH', 2, 'FAMILY'],
  // The scientist's scan: always x2, whatever the level (astronaut only)
  ['RADIATION', 0.2, 'LOW', 2, 'ASTRONAUT'], ['RADIATION', 0.7, 'NORMAL', 2, 'ASTRONAUT'], ['RADIATION', 1.5, 'HIGH', 2, 'ASTRONAUT'],
  ['CO2', 1000, 'FRESH', 2, 'ASTRONAUT'], ['CO2', 3000, 'FINE', 2, 'ASTRONAUT'], ['CO2', 6000, 'HIGH', 2, 'ASTRONAUT'],
];

console.log('1. Answers from the design script');
for (const [metric, value, wantBand, wantPays, only] of SCRIPT) {
  for (const role of only ? [only] : ['ASTRONAUT', 'FAMILY']) {
    checks++;
    const a = answer(role, metric, value);
    const where = `${role} ${metric} ${value}`;
    if (S.validateMeasurement(metric, value)) fail(`${where}: rejected as invalid (${S.validateMeasurement(metric, value)})`);
    else if (!a.band) fail(`${where}: no band`);
    else if (a.band.id !== wantBand) fail(`${where}: band ${a.band.id}, expected ${wantBand}`);
    else if (a.pays !== wantPays) fail(`${where}: pays x${a.pays}, expected x${wantPays}`);
    else if (!a.lines?.length && !S.crewFor(role).find((c) => c.metrics.includes(metric))?.scans) fail(`${where}: no reply line for ${a.band.id}`);
  }
}

// ---------------------------------------------------------------- 2. every value in range answers
console.log('2. Every value in each reading\'s range gets a band and a reply');
for (const role of ['ASTRONAUT', 'FAMILY']) {
  for (const member of S.crewFor(role)) {
    for (const metric of member.metrics) {
      const def = S.METRICS[metric];
      // A fine walk: a tenth of the input step, so off-step answers (2501 kcal, 2.1 L) are covered too.
      const step = def.step / 10;
      for (let i = 0; def.min + i * step <= def.max + 1e-9; i++) {
        const value = +(def.min + i * step).toFixed(6);
        checks++;
        const a = answer(role, metric, value);
        if (!a.band) { fail(`${role} ${metric} ${value}: no band`); break; }
        if (!member.scans && !a.lines?.length) { fail(`${role} ${metric} ${value}: no reply line for ${a.band.id}`); break; }
      }
      // Just outside the range: the crew's input rejects it instead of answering.
      for (const value of [def.min - def.step, def.max + def.step]) {
        checks++;
        if (!S.validateMeasurement(metric, value)) fail(`${role} ${metric} ${value}: out of range but accepted`);
      }
      // Every question has wording, and "Don't know" has a reply wherever it's offered.
      checks++;
      if (!member.scans && !L.ASK[metric]?.length) fail(`${metric}: no question line`);
      if (S.unknownRewardFor(metric, role) !== null) {
        checks++;
        if (!L.replyLines(metric, S.UNKNOWN_BAND, role)?.length) fail(`${role} ${metric}: "Don't know" has no reply`);
      }
    }
  }
}

// ---------------------------------------------------------------- 3. buttons, owners, crew lines
console.log('3. Answer buttons, crew owners and crew lines');
for (const role of ['ASTRONAUT', 'FAMILY']) {
  for (const b of S.choicesFor('STRESS', role)) {
    checks++;
    const a = answer(role, 'STRESS', b.value);
    if (a.band?.id !== b.id) fail(`${role} stress button "${b.label}" (${b.value}) reads as ${a.band?.id}`);
  }
  const owned = S.crewFor(role).flatMap((c) => c.metrics);
  for (const metric of S.metricsFor(role)) {
    checks++;
    const n = owned.filter((m) => m === metric).length;
    if (n !== 1) fail(`${role} ${metric}: asked by ${n} crew members, expected exactly 1`);
  }
  for (const c of S.crewFor(role)) {
    checks++;
    const said = c.metrics.length ? [L.INTRO[c.id], L.LATER[c.id], L.ALL_DONE[c.id]] : [L.NOTHING_TO_ASK[c.id]];
    if (said.some((lines) => !lines?.length)) fail(`${role} ${c.id}: missing intro, later, goodbye or hello lines`);
  }
}

console.log(failures ? `\n${failures} of ${checks} checks failed.` : `\nAll ${checks} checks passed.`);
process.exit(failures ? 1 : 0);
