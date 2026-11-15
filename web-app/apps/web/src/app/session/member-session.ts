import { isDevMode } from '@angular/core';
import { DEMO_MEMBERS, type Member, SUITS, type Suit, type UserRole, normalizeStationKey } from '@garden/shared';
import { loadJson, saveJson } from '../shared/storage';

/** A deployed build sets this (angular.json → `define`); see the README. */
declare const API_URL: string | undefined;
/**
 * The API: the deployed URL, else port 3000 on whatever host served this page (any local dev
 * server, or a phone on the LAN). A path (`/api`, from `dev:web:railway`) is this page's own
 * origin: the dev server proxies it to Railway, so the browser never makes a cross-origin call.
 */
const API = typeof API_URL === 'string' ? new URL(API_URL, location.href).href.replace(/\/$/, '') : `${location.protocol}//${location.hostname}:3000/api`;

const SESSION_KEY = 'jardin-comunal:session:v1';
/** How long to wait for the station before giving up (boot waits on the session check). */
const TIMEOUT_MS = 8000;

/** What this device remembers between visits, so it can still say who's who when the API is out of reach. */
interface Session {
  token: string;
  member: Member;
  stationKey: string;
  members: readonly Member[];
}

/** The signed-in session (set once, before the game boots), or a dev stand-in with no session. */
let session: Session | null = null;
let devPlayer: Member | null = null;

/** Who is playing: the dev stand-in, else the signed-in member, else nobody (the start menu shows). */
export const currentMember = (): Member | null => devPlayer ?? session?.member ?? null;
/** This station's key, to share (none for the dev stand-in). */
export const stationKey = (): string | null => (devPlayer ? null : (session?.stationKey ?? null));
/** Everyone in this station, for names and colours on shared things. */
export const householdMembers = (): readonly Member[] => (devPlayer ? DEMO_MEMBERS : (session?.members ?? []));

/** What players see when a request can't get through. */
export const OFFLINE_MESSAGE = "Can't reach the station. Try again.";

class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

async function call<T>(path: string, init: RequestInit = {}, token?: string): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body) headers.set('content-type', 'application/json');
  if (token) headers.set('authorization', `Bearer ${token}`);
  const url = `${API}${path}`;
  let res: Response;
  try {
    res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS), ...init, headers });
  } catch (e) {
    // Only a failed or timed-out request means the station is out of reach.
    if (e instanceof TypeError || (e instanceof DOMException && e.name === 'TimeoutError')) {
      throw new ApiError(0, OFFLINE_MESSAGE);
    }
    throw e;
  }
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { message?: string | string[] } | null;
    throw new ApiError(res.status, [body?.message ?? res.statusText].flat().join(' '));
  }
  return (res.status === 204 ? undefined : await res.json()) as T;
}

/** The live channel's address (WebSocket, same host and port as the API). */
export const LIVE_URL = `${API.replace(/^http/, 'ws')}/live`;

/** This device's session token on a station, if signed in. */
export const sessionToken = (): string | null => (devPlayer ? null : (session?.token ?? null));

/** The session ended elsewhere (signed out, expired): forget it and reload, which brings back the start menu. */
export function sessionEnded(): void {
  saveJson(SESSION_KEY, null);
  location.reload();
}

/** True when this page talks to the station's server (a signed-in member, not the dev stand-in). */
export const onStation = (): boolean => !!sessionToken();

/** "Can't reach the station": the request failed or timed out (not a refusal from the server). */
export const isOffline = (e: unknown): boolean => e instanceof ApiError && e.status === 0;

/**
 * A call to the station's API as the signed-in member. A session that ended elsewhere
 * reloads the page, which brings back the start menu.
 */
export async function stationCall<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (!session) throw new Error('Not signed in to a station.');
  try {
    return await call<T>(path, init, session.token);
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) sessionEnded();
    throw e;
  }
}

/**
 * Send a command to the station with an id made once, so the retry after a dropped connection
 * can't do it twice: the station answers a repeated id from its records. `send` wraps each try
 * (e.g. to time it). Null when the station stayed out of reach.
 */
export async function sendCommand<T>(path: string, command: unknown, send: (request: () => Promise<T>) => Promise<T> = (r) => r()): Promise<T | null> {
  const body = JSON.stringify({ id: crypto.randomUUID(), command });
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      return await send(() => stationCall<T>(path, { method: 'POST', body }));
    } catch (e) {
      if (!isOffline(e)) throw e;
    }
  }
  return null;
}

/**
 * Dev builds only: `?user=astronaut|family` (with an optional `&suit=`) plays as that demo
 * member with no API and no session, e.g. two players side by side.
 */
function devStandIn(): Member | null {
  if (!isDevMode()) return null;
  const q = new URLSearchParams(location.search);
  const asked = q.get('user')?.toLowerCase();
  if (!asked) return null;
  const member = DEMO_MEMBERS.find((m) => m.id === `${asked}-demo`) ?? DEMO_MEMBERS[0];
  const suit = SUITS.find((s) => s === q.get('suit')?.toLowerCase());
  return suit ? { ...member, suit } : member;
}

/**
 * Settles who is playing before the game loads: the dev stand-in, or this device's session
 * checked with the server. A session that ended leaves nobody (the start menu shows); if the
 * server is out of reach, you play as who you were, since the garden is still on this device.
 */
export async function resumeSession(): Promise<void> {
  devPlayer = devStandIn();
  const saved = loadJson<Session | null>(SESSION_KEY, null);
  if (devPlayer || !saved) return;
  try {
    const now = await call<Omit<Session, 'token'>>('/session', {}, saved.token);
    session = { token: saved.token, ...now };
    saveJson(SESSION_KEY, session);
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) saveJson(SESSION_KEY, null);
    else session = saved;
  }
}

export interface PlayerChoice {
  name: string;
  role: UserRole;
  suit: Suit;
  /** Blank starts a new station (or, signed in, keeps yours). */
  stationKey: string;
}

/**
 * The start menu's Start. Signed in and staying on the same station: updates your member.
 * Otherwise: becomes a new member of the station the key names (or of a new station).
 * Throws with a message to show; on success the caller reloads.
 */
export async function savePlayer(choice: PlayerChoice): Promise<void> {
  const key = normalizeStationKey(choice.stationKey);
  const changes = { displayName: choice.name, role: choice.role, suit: choice.suit };
  if (session && (!key || key === session.stationKey)) {
    const member = await call<Member>('/members/me', { method: 'PATCH', body: JSON.stringify(changes) }, session.token);
    saveJson(SESSION_KEY, { ...session, member, members: session.members.map((m) => (m.id === member.id ? member : m)) });
    return;
  }
  adopt(await call<Omit<Session, 'members'>>('/join', { method: 'POST', body: JSON.stringify({ ...changes, stationKey: key || undefined }) }));
}

/** Who's in the station a key names (an unknown key throws "No station has that key…"). */
export const stationMembers = (key: string): Promise<Member[]> => call<Member[]>(`/stations/${encodeURIComponent(normalizeStationKey(key))}/members`);

/** "That's me": sign in as someone already in that station. On success the caller reloads. */
export async function signInAs(key: string, memberId: string): Promise<void> {
  adopt(await call<Omit<Session, 'members'>>('/session', { method: 'POST', body: JSON.stringify({ stationKey: key, memberId }) }));
}

/** Use a new session on this device, ending the old one without holding up the reload. */
function adopt(next: Omit<Session, 'members'>): void {
  if (session) void call('/session', { method: 'DELETE', keepalive: true }, session.token).catch(() => {});
  saveJson(SESSION_KEY, { ...next, members: [next.member] });
}
