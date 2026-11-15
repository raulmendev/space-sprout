import { Injectable, signal } from '@angular/core';
import { LIVE_DENIED, type LiveServerMessage } from '@garden/shared';
import { LIVE_URL, sessionEnded, sessionToken } from '../session/member-session';

export type LiveStatus = 'off' | 'connecting' | 'live' | 'reconnecting';
export type GardenNews = Extract<LiveServerMessage, { type: 'GARDEN' }>;

interface Listener {
  /** Someone in the station changed the garden. */
  garden(news: GardenNews): void;
  /** (Re)connected: reload, since changes may have happened while we weren't listening. */
  caughtUp(): void;
}

/** Longest wait between reconnection attempts. */
const MAX_RETRY_MS = 30_000;

/**
 * The station's live channel: hears every change anyone in the station makes, as it happens.
 * Only for a signed-in member (the dev stand-in and the garden behind the start menu stay local).
 * A dropped connection retries with growing waits, and straight away when the network comes
 * back or the tab is shown again.
 */
@Injectable({ providedIn: 'root' })
export class LiveChannel {
  readonly status = signal<LiveStatus>('off');
  private listener?: Listener;
  private socket?: WebSocket;
  private failures = 0;
  private retryTimer?: ReturnType<typeof setTimeout>;

  start(listener: Listener): void {
    if (this.listener || !sessionToken()) return;
    this.listener = listener;
    const reconnectNow = () => {
      if (this.status() === 'reconnecting') this.open();
    };
    addEventListener('online', reconnectNow);
    document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && reconnectNow());
    this.open();
  }

  private open(): void {
    clearTimeout(this.retryTimer);
    this.socket?.close();
    this.status.set(this.failures ? 'reconnecting' : 'connecting');
    const socket = (this.socket = new WebSocket(LIVE_URL));
    socket.onopen = () => socket.send(JSON.stringify({ type: 'AUTH', token: sessionToken() }));
    socket.onmessage = (e) => {
      const message = JSON.parse(e.data as string) as LiveServerMessage;
      if (message.type === 'READY') {
        this.failures = 0;
        this.status.set('live');
        this.listener?.caughtUp();
      } else if (message.type === 'GARDEN') this.listener?.garden(message);
      else if (message.type === 'DENIED') sessionEnded();
    };
    socket.onclose = (e) => {
      if (socket !== this.socket || e.code === LIVE_DENIED) return; // replaced, or signed out (DENIED handles it)
      this.failures++;
      this.status.set('reconnecting');
      this.retryTimer = setTimeout(() => this.open(), Math.min(MAX_RETRY_MS, 1000 * 2 ** (this.failures - 1)));
    };
  }
}
