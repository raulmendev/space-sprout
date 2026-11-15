import { Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import { EMOTE_MS, type EmoteId, PRESENCE_EVERY_MS, type Presence, type Stance } from '@garden/shared';
import { LiveChannel, type PresenceNews } from '../garden/live-channel';
import { PlayerStore, SPEED, WAVE_MS } from './player.store';
import { Ticker } from './ticker.service';

/** Someone else in the station, as drawn here: eased toward where they last said they were. */
export interface OtherPlayer extends Presence {
  x: number;
  y: number;
  /** Walking, as drawn (still easing in counts). */
  moving: boolean;
  emote: { id: EmoteId; at: number } | null;
  waveAt: number | null;
}

/** Further than this (tiles) from where they are drawn, someone jumps there instead of walking. */
const SNAP_TILES = 4;
/** Easing: close the gap in about this long, never slower than walking pace. */
const CATCH_UP_S = 0.15;

/**
 * Presence: the other players in the station, live. Tells the station where this player stands
 * (every PRESENCE_EVERY_MS while walking, at once on stopping) and which emotes they send, and
 * draws everyone else from what the station relays. Signed-in players only: the live channel
 * never starts for the dev stand-in. Nothing here is ever stored.
 */
@Injectable({ providedIn: 'root' })
export class PresenceStore {
  private readonly live = inject(LiveChannel);
  private readonly player = inject(PlayerStore);
  private readonly ticker = inject(Ticker);

  private readonly people = signal<ReadonlyMap<string, OtherPlayer>>(new Map());
  readonly others = computed(() => [...this.people().values()]);
  private sendTimer?: ReturnType<typeof setTimeout>;
  private lastSent = 0;
  private readonly timers = new Map<string, ReturnType<typeof setTimeout>>();

  constructor() {
    this.live.listenToPresence({
      ready: (present) => {
        this.people.set(new Map(present.map((p) => [p.peer, arrive(p)])));
        this.sendStance(); // whoever is here (or came in while we were away) learns where we are
      },
      news: (news) => this.heard(news),
    });
    // Where we are, as we move.
    effect(() => {
      this.player.position();
      this.player.facing();
      const moving = this.player.moving();
      untracked(() => (moving ? this.sendSoon() : this.sendStance()));
    });
    // Our emotes, as we send them.
    effect(() => {
      const emote = this.player.emote();
      if (emote) untracked(() => this.live.send({ type: 'EMOTE', emote: emote.id }));
    });
  }

  private stance(): Stance {
    return { at: this.player.position(), facing: this.player.facing(), moving: this.player.moving() };
  }

  private sendStance(): void {
    clearTimeout(this.sendTimer);
    this.sendTimer = undefined;
    this.lastSent = performance.now();
    this.live.send({ type: 'STANCE', stance: this.stance() });
  }

  /** While walking: at most one stance every PRESENCE_EVERY_MS, always the latest. */
  private sendSoon(): void {
    if (this.sendTimer) return;
    this.sendTimer = setTimeout(() => this.sendStance(), Math.max(0, this.lastSent + PRESENCE_EVERY_MS - performance.now()));
  }

  private heard(news: PresenceNews): void {
    const people = new Map(this.people());
    const them = people.get(news.peer);
    switch (news.type) {
      case 'STANCE': {
        const { peer, member, stance } = news;
        people.set(peer, them && them.stance.at.room === stance.at.room ? { ...them, member, stance } : arrive({ peer, member, stance }));
        this.ticker.add(this.ease);
        break;
      }
      case 'EMOTE':
        if (!them) return;
        people.set(news.peer, { ...them, emote: { id: news.emote, at: performance.now() }, waveAt: them.moving ? null : performance.now() });
        clearTimeout(this.timers.get(news.peer));
        this.timers.set(news.peer, setTimeout(() => this.update(news.peer, { emote: null, waveAt: null }), Math.max(EMOTE_MS, WAVE_MS)));
        break;
      case 'LEFT':
        people.delete(news.peer);
        clearTimeout(this.timers.get(news.peer));
        this.timers.delete(news.peer);
        break;
    }
    this.people.set(people);
  }

  private update(peer: string, change: Partial<OtherPlayer>): void {
    const them = this.people().get(peer);
    if (them) this.people.set(new Map(this.people()).set(peer, { ...them, ...change }));
  }

  /** Each frame: everyone eases toward where they last said they were. Stops once they're all there. */
  private readonly ease = (dt: number): void => {
    let settled = true;
    const people = new Map<string, OtherPlayer>();
    for (const [peer, p] of this.people()) {
      const { x, y } = p.stance.at;
      const dist = Math.hypot(x - p.x, y - p.y);
      if (dist < 1e-3 || dist > SNAP_TILES) {
        people.set(peer, { ...p, x, y, moving: p.stance.moving });
        continue;
      }
      const step = Math.min(dist, Math.max(SPEED, dist / CATCH_UP_S) * dt);
      people.set(peer, { ...p, x: p.x + ((x - p.x) * step) / dist, y: p.y + ((y - p.y) * step) / dist, moving: true, waveAt: null });
      settled = false;
    }
    this.people.set(people);
    if (settled) this.ticker.remove(this.ease);
  };
}

/** Someone appearing: drawn right where they are. */
const arrive = (p: Presence): OtherPlayer => ({ ...p, x: p.stance.at.x, y: p.stance.at.y, moving: p.stance.moving, emote: null, waveAt: null });
