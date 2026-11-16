import { t } from '../i18n/i18n';

/** "1 post-it", "3 post-its". */
export function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}

/** "1 seed", "3 seeds": the in-game currency, pluralised. */
export const seeds = (n: number) => (n === 1 ? t('1 seed') : t('{n} seeds', { n }));

/** "1 more seed", "3 more seeds": how far short a purchase is. */
export const moreSeeds = (n: number) => (n === 1 ? t('1 more seed') : t('{n} more seeds', { n }));

/** "you", or the household member's name ("Family"): who did something. */
export const whoDid = (id: string | undefined, name: string | undefined, me: string) =>
  id && id === me ? t('you') : (name ?? t('someone'));
