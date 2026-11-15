import { Injectable, signal } from '@angular/core';
import { LIVE_DENIED, type LiveServerMessage } from '@garden/shared';
import { LIVE_URL, sessionEnded, sessionToken } from '../session/member-session';

export type GardenNews = Extract<LiveServerMessage, { type: 'GARDEN' }>;

interface Listener {
  /** Someone in the station changed the garden. */
  garden(news: GardenNews): void;
  /** Reconnected: reload, since changes may have happened while we weren't listening. */
  caughtUp(): void;
}

/** Longest wait between reconnection attempts. */
const MAX_RETRY_MS = 30_000;

/**
 * The station's live channel: hears every change anyone in the station makes, as it happens.
 * Only for a signed-in member (the dev stand-in and the garden behind the start menu stay local).
 * A dropped connection retries with growing, jittered waits (so a restarted server isn't hit by
 * everyone at once), and straight away when the network comes back or the tab is shown again.
 * A 4401 close means the session ended (signed out, expired): back to the start menu.
 */
@Injectable({ providedIn: 'root' })
export class LiveChannel {
  /** The connection dropped and is being retried. */
  readonly reconnecting = signal(false);
  private listener?: Listener;
  private socket?: WebSocket;
  private failures = 0;
  private retryTimer?: ReturnType<typeof setTimeout>;

  start(listener: Listener): void {
    if (this.listener || !sessionToken()) return;
    this.listener = listener;
    const retryNow = () => this.reconnecting() && this.open();
    addEventListener('online', retryNow);
    document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && retryNow());
    this.open();
  }

  private open(): void {
    clearTimeout(this.retryTimer);
    this.socket?.close();
    const socket = (this.socket = new WebSocket(LIVE_URL));
    socket.onopen = () => socket.send(JSON.stringify({ type: 'AUTH', token: sessionToken() }));
    socket.onmessage = (e) => {
      const message = JSON.parse(e.data as string) as LiveServerMessage;
      if (message.type === 'READY') {
        if (this.reconnecting()) this.listener?.caughtUp(); // the first connect follows a fresh load
        this.failures = 0;
        this.reconnecting.set(false);
      } else this.listener?.garden(message);
    };
    socket.onclose = (e) => {
      if (socket !== this.socket) return; // replaced by a newer connection
      if (e.code === LIVE_DENIED) return sessionEnded();
      this.failures++;
      this.reconnecting.set(true);
      const wait = Math.min(MAX_RETRY_MS, 1000 * 2 ** (this.failures - 1)) * (0.5 + Math.random());
      this.retryTimer = setTimeout(() => this.open(), wait);
    };
  }
}
