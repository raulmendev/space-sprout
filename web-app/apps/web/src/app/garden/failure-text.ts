import type { GardenError } from '@garden/shared';
import { OFFLINE_MESSAGE } from '../session/member-session';
import type { GardenFailure } from './garden.service';

/**
 * What to tell the player when a garden action didn't go through: the station being out of
 * reach is said the same way everywhere; rule refusals come from the caller's own wording.
 */
export function failureText(texts: Partial<Record<GardenError, string>>, error: GardenFailure): string {
  return error === 'OFFLINE' ? OFFLINE_MESSAGE : (texts[error] ?? "That didn't work. Try again.");
}
