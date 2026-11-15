import { Injectable, inject, signal } from '@angular/core';
import {
  CREW,
  HabitatPosition,
  NPC_HOME,
  NpcId,
  Point,
  ROOMS,
  canStand,
  clearLine,
  distance,
  planRoute,
  tileCenter,
  tileOf,
} from '@garden/shared';
import { PlayerStore } from '../habitat/player.store';
import { Ticker } from '../habitat/ticker.service';
import { NpcStore } from './npc.store';

/** What the renderer and the rest of the app see of an NPC. */
export interface NpcView {
  id: NpcId;
  position: HabitatPosition;
  facingLeft: boolean;
  moving: boolean;
}

const SPEED = 2.2; // tiles per second: an amble
const APPROACH_SPEED = 3.2; // a little brisker when coming over to say hi
/** Chance, each time a roamer finishes resting, of heading to a neighbouring room. */
const TRAVEL_CHANCE = 0.3;
/** Close enough to talk (tiles, feet to feet). */
const TALK_DISTANCE = 1.3;

/** How each NPC moves: Sprout potters around its spot in the garden; the crew roam the station. */
const MOVES: readonly { id: NpcId; start: HabitatPosition; home?: Point; radius: number }[] = [
  { id: 'SPROUT', start: NPC_HOME, home: NPC_HOME, radius: 2.5 },
  ...CREW.map((c) => ({ id: c.id, start: c.start, radius: 3 })),
];

interface Walker extends NpcView {
  home?: Point;
  radius: number;
  route: Point[];
  /** Set while walking to a door: where it leads. */
  door: HabitatPosition | null;
  /** Standing still until then (resting, or facing the player). */
  restUntil: number;
  /** Set while walking over to the player; called once they're close. */
  approach: { onArrive: () => void; replanAt: number } | null;
}

/**
 * Where every NPC is and where it's walking. They keep moving in rooms you
 * can't see, stop to face you while they're talking, and can be sent over to
 * the player. Deciding *when* the crew come over is CrewReminders' job.
 */
@Injectable({ providedIn: 'root' })
export class NpcActorStore {
  private readonly player = inject(PlayerStore);
  private readonly dialogue = inject(NpcStore);
  private readonly ticker = inject(Ticker);

  private walkers: Walker[] = [];
  readonly view = signal<readonly NpcView[]>([]);

  constructor() {
    this.reset();
    this.ticker.add(this.tick);
  }

  get(id: NpcId): NpcView | undefined {
    return this.view().find((c) => c.id === id);
  }

  /** Walk over to the player, then call `onArrive`. Gives up if the player leaves the room. */
  comeOver(id: NpcId, onArrive: () => void): void {
    const w = this.walker(id);
    w.door = null;
    w.route = [];
    w.approach = { onArrive, replanAt: 0 };
  }

  /** Stop and face the player for a while, e.g. while they walk up to talk. */
  hold(id: NpcId, ms = 8000): void {
    const w = this.walker(id);
    w.route = [];
    w.door = null;
    w.approach = null;
    this.face(w, ms);
    this.publish();
  }

  reset(): void {
    const now = performance.now();
    this.walkers = MOVES.map((m) => ({
      ...m,
      position: m.start,
      facingLeft: false,
      moving: false,
      route: [],
      door: null,
      restUntil: now + Math.random() * 3000,
      approach: null,
    }));
    this.publish();
  }

  private readonly tick = (dt: number): void => {
    const now = performance.now();
    const speaking = this.dialogue.current()?.speaker;
    let changed = false;
    for (const w of this.walkers) {
      if (w.id === speaking) {
        if (w.moving || w.route.length || w.facingLeft !== (this.player.position().x < w.position.x)) changed = true;
        w.route = [];
        w.door = null;
        w.approach = null;
        this.face(w, 1500); // stand still facing the player while talking, and a moment after
      } else {
        changed = this.step(w, dt, now) || changed;
      }
    }
    if (changed) this.publish();
  };

  /** Advance one walker. Returns whether anything visible changed. */
  private step(w: Walker, dt: number, now: number): boolean {
    if (w.approach) return this.stepApproach(w, w.approach, dt, now);

    if (!w.route.length) {
      if (w.door) {
        // Through the door: appear just inside the next room, then wander from there.
        w.position = w.door;
        w.door = null;
        w.restUntil = now + 1000;
        return true;
      }
      const wasMoving = w.moving;
      w.moving = false;
      if (now >= w.restUntil) {
        this.planNext(w);
        w.restUntil = now + 2500 + Math.random() * 4500;
      }
      return wasMoving;
    }

    this.walk(w, SPEED * dt);
    return true;
  }

  private stepApproach(w: Walker, approach: NonNullable<Walker['approach']>, dt: number, now: number): boolean {
    const me = this.player.position();
    if (me.room !== w.position.room) {
      w.approach = null; // they left: never mind
      w.route = [];
      return false;
    }
    if (distance(me, w.position) <= TALK_DISTANCE) {
      this.hold(w.id);
      approach.onArrive();
      return true;
    }
    // The player may be walking, so re-plan the route a few times a second.
    if (now >= approach.replanAt) {
      approach.replanAt = now + 400;
      w.route = clearLine(me.room, w.position, me) ? [{ x: me.x, y: me.y }] : (planRoute(me.room, w.position, tileOf(me)) ?? []);
      if (!w.route.length) {
        w.approach = null; // can't get there from here
        return false;
      }
    }
    this.walk(w, APPROACH_SPEED * dt);
    return true;
  }

  /** Move along the route by up to `stepLen` tiles. */
  private walk(w: Walker, stepLen: number): void {
    const target = w.route[0];
    const dist = distance(target, w.position);
    const { room, x, y } = w.position;
    if (dist <= stepLen) {
      w.route.shift();
      w.position = { room, x: target.x, y: target.y };
    } else {
      const dx = ((target.x - x) / dist) * stepLen;
      w.position = { room, x: x + dx, y: y + ((target.y - y) / dist) * stepLen };
      if (Math.abs(dx) > 1e-4) w.facingLeft = dx < 0;
    }
    w.moving = true;
  }

  /** Pick what to do after resting: stroll somewhere nearby, or (roamers only) head through a door. */
  private planNext(w: Walker): void {
    const room = w.position.room;
    const doors = ROOMS[room].doors;
    if (!w.home && doors.length && Math.random() < TRAVEL_CHANCE) {
      const door = doors[Math.floor(Math.random() * doors.length)];
      const route = planRoute(room, w.position, door);
      if (route?.length) {
        w.route = route;
        w.door = { room: door.to, ...tileCenter(door.arrive) };
        return;
      }
    }
    const centre = w.home ?? w.position;
    for (let i = 0; i < 8; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = 0.8 + Math.random() * w.radius;
      const p = { x: centre.x + Math.cos(a) * r, y: centre.y + Math.sin(a) * r * 0.6 };
      if (canStand(room, p) && clearLine(room, w.position, p)) {
        w.route = [p];
        return;
      }
    }
  }

  private face(w: Walker, ms: number): void {
    w.moving = false;
    w.restUntil = Math.max(w.restUntil, performance.now() + ms);
    w.facingLeft = this.player.position().x < w.position.x;
  }

  private walker(id: NpcId): Walker {
    return this.walkers.find((w) => w.id === id)!;
  }

  /** Publish a new view, reusing the previous object for anyone who didn't change (so unchanged rooms don't redraw). */
  private publish(): void {
    const prev = this.view();
    this.view.set(
      this.walkers.map((w, i) => {
        const p = prev[i];
        return p && p.position === w.position && p.facingLeft === w.facingLeft && p.moving === w.moving
          ? p
          : { id: w.id, position: w.position, facingLeft: w.facingLeft, moving: w.moving };
      }),
    );
  }
}
