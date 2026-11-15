import { Injectable, signal } from '@angular/core';
import { LIVE_DENIED, type LiveClientMessage, type LiveServerMessage, type Presence } from '@garden/shared';
import { LIVE_URL, sessionEnded, sessionToken } from '../session/member-session';

export type GardenNews = Extract<LiveServerMessage, { type: 'GARDEN' }>;
/** Someone else moved, sent an emote, or left. */
export type PresenceNews = Extract<LiveServerMessage, { type: 'STANCE' | 'EMOTE' | 'LEFT' }>;

interface PresenceListener {
  /** (Re)connected: everyone else in the station right now, where they stand. */
  ready(present: Presence[]): void;
  news(news: PresenceNews): void;
}

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
  private presence?: PresenceListener;
  private socket?: WebSocket;
  /** The socket is open and signed in: messages can go out. */
  private ready = false;
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

  /** Hear who else is in the station (presence), from the next connect on. */
  listenToPresence(listener: PresenceListener): void {
    this.presence = listener;
  }

  /** Tell the station something (where I am, an emote). Dropped while not connected: a reconnect resends the stance. */
  send(message: LiveClientMessage): void {
    if (this.ready) this.socket?.send(JSON.stringify(message));
  }

  /**
   * Connect again now. The station keeps who we are (name, suit) from when we connected, so
   * a change to them reaches everyone else only through a new connection.
   */
  reconnect(): void {
    if (this.listener) this.open();
  }

  private open(): void {
    this.ready = false;
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
        this.ready = true;
        this.presence?.ready(message.present);
      } else if (message.type === 'GARDEN') this.listener?.garden(message);
      else this.presence?.news(message);
    };
    socket.onclose = (e) => {
      if (socket !== this.socket) return; // replaced by a newer connection
      this.ready = false;
      if (e.code === LIVE_DENIED) return sessionEnded();
      this.failures++;
      this.reconnecting.set(true);
      const wait = Math.min(MAX_RETRY_MS, 1000 * 2 ** (this.failures - 1)) * (0.5 + Math.random());
      this.retryTimer = setTimeout(() => this.open(), wait);
    };
  }
}
