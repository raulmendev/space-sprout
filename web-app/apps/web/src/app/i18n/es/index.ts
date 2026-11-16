import { ES_CORE } from './core';
import { ES_CREW } from './crew';
import { ES_GARDEN } from './garden';
import { ES_HEALTH } from './health';

/** Spanish, keyed by the English text. One file per area of the game; merged here. */
export const ES: Readonly<Record<string, string>> = {
  ...ES_CORE,
  ...ES_GARDEN,
  ...ES_HEALTH,
  ...ES_CREW,
};
