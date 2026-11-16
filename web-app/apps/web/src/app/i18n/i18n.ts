import { isDevMode, signal } from '@angular/core';
import { loadJson, saveJson } from '../shared/storage';
import { ES } from './es';

/**
 * The player's language. English is the source: every string in the code is the
 * English text, and `t()` swaps it for its Spanish entry in `es/`. Strings from
 * `@garden/shared` (item names, crew lines…) stay English there, so the server
 * and the rules never depend on the language; the screen translates them.
 */
export type Lang = 'en' | 'es';
export const LANGS: readonly { id: Lang; name: string }[] = [
  { id: 'en', name: 'English' },
  { id: 'es', name: 'Español' },
];

const KEY = 'space-sprout:lang';

/** A saved choice wins; otherwise follow the device. */
function initialLang(): Lang {
  const saved = loadJson<Lang | null>(KEY, null);
  if (saved === 'en' || saved === 'es') return saved;
  return typeof navigator !== 'undefined' && navigator.language?.toLowerCase().startsWith('es') ? 'es' : 'en';
}

export const LANG = signal<Lang>(initialLang());
if (typeof document !== 'undefined') document.documentElement.lang = LANG();

export function setLang(lang: Lang): void {
  LANG.set(lang);
  saveJson(KEY, lang);
  document.documentElement.lang = lang;
}

const missing = new Set<string>();

/**
 * The text in the player's language. `{name}` placeholders are filled from
 * `params` in both languages. Reads `LANG`, so templates and computeds that
 * call it update when the language changes.
 *
 * When one English word means two things in Spanish, the key carries a context
 * after `|` ('Water|verb' → "Water" / "Regar"); English shows the part before it.
 */
export function t(en: string, params?: Record<string, string | number>): string {
  const bar = en.indexOf('|');
  let text = bar < 0 ? en : en.slice(0, bar);
  if (LANG() === 'es') {
    const es = ES[en];
    if (es !== undefined) text = es;
    else if (isDevMode() && en && !missing.has(en)) {
      missing.add(en);
      console.warn('[i18n] no Spanish for:', en);
    }
  }
  return params ? text.replace(/\{(\w+)\}/g, (m, k: string) => (k in params ? String(params[k]) : m)) : text;
}
