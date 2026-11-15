import { bootstrapApplication } from '@angular/platform-browser';
import { resumeSession } from './app/session/member-session';
import { watchKeyboard } from './app/shared/keyboard';

/**
 * Who is playing is settled before the game loads: much of the game reads the player
 * once, at import (their role, readings, crew, save keys). So the session is checked
 * with the server first, and only then is the game imported.
 */
async function start(): Promise<void> {
  watchKeyboard();
  await resumeSession();
  const [{ App }, { appConfig }] = await Promise.all([import('./app/app'), import('./app/app.config')]);
  await bootstrapApplication(App, appConfig);
}

start().catch((err) => console.error(err));
