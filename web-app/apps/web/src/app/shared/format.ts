/** "1 post-it", "3 post-its". */
export function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}

/** "1 seed", "3 seeds": the in-game currency, pluralised. */
export const seeds = (n: number) => plural(n, 'seed');

/** "1 more seed", "3 more seeds": how far short a purchase is. */
export const moreSeeds = (n: number) => `${n} more seed${n === 1 ? '' : 's'}`;
