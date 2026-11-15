import { LIVE_DENIED, type LiveClientMessage, type LiveServerMessage, PRESENCE_EVERY_MS, type Presence, type PresenceMember, type Stance, isEmote, readStance } from '@garden/shared';
import { Injectable, Logger, type OnApplicationBootstrap, type OnApplicationShutdown } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { randomUUID } from 'node:crypto';
import type { Subscription } from 'rxjs';
import { WebSocket, WebSocketServer } from 'ws';
import { SessionService } from '../session/session.service';

/** How long a new connection has to send its token. */
const AUTH_TIMEOUT_MS = 5000;
/** Pings find connections that died without closing (phones sleeping, networks dropping); expired sessions are closed then too. */
const HEARTBEAT_MS = 30_000;

/** Stances closer together than this are dropped (a device sends one every PRESENCE_EVERY_MS while moving). */
const MIN_STANCE_GAP_MS = PRESENCE_EVERY_MS / 2;

/** A signed-in connection: its station, its session (to close it when the session ends), and where its player stands. */
interface Peer {
  id: string;
  householdId: string;
  tokenHash: string;
  expiresAt: Date;
  member: PresenceMember;
  /** Unknown until the device first says. */
  stance?: Stance;
  stanceAt: number;
}

/**
 * The live channel: /api/live on the API's own port. Each signed-in connection joins its
 * station, and every change to that station's garden is sent to all of them. Players also say
 * where they stand and send emotes, relayed to the rest of the station (presence: kept in memory
 * only, never stored). In memory: with one API instance that's every connection; more instances
 * would need a shared broadcast (Redis).
 */
@Injectable()
export class LiveService implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly log = new Logger('Live');
  private readonly peers = new Map<WebSocket, Peer>();
  private readonly stations = new Map<string, Set<WebSocket>>();
  /** Connections that answered the last ping. */
  private readonly answered = new WeakSet<WebSocket>();
  private wss?: WebSocketServer;
  private heartbeat?: NodeJS.Timeout;
  private signOuts?: Subscription;

  constructor(
    private readonly http: HttpAdapterHost,
    private readonly sessions: SessionService,
  ) {}

  onApplicationBootstrap(): void {
    this.wss = new WebSocketServer({ server: this.http.httpAdapter.getHttpServer(), path: '/api/live', maxPayload: 4096 });
    this.wss.on('connection', (socket) => this.welcome(socket));
    this.heartbeat = setInterval(() => this.checkPeers(), HEARTBEAT_MS);
    this.signOuts = this.sessions.ended.subscribe((tokenHash) => {
      for (const [socket, peer] of this.peers) if (peer.tokenHash === tokenHash) socket.close(LIVE_DENIED, 'Signed out');
    });
  }

  onApplicationShutdown(): void {
    clearInterval(this.heartbeat);
    this.signOuts?.unsubscribe();
    this.wss?.close();
  }

  /** Send to everyone in a station (except `from`'s member, on all their devices: they know where they are). */
  broadcast(householdId: string, message: LiveServerMessage, from?: Peer): void {
    const sockets = this.stations.get(householdId);
    if (!sockets?.size) return;
    const data = JSON.stringify(message);
    for (const socket of sockets) {
      if (from && this.peers.get(socket)?.member.id === from.member.id) continue;
      if (socket.readyState === WebSocket.OPEN) socket.send(data);
    }
  }

  private welcome(socket: WebSocket): void {
    const deadline = setTimeout(() => socket.close(LIVE_DENIED, 'No token'), AUTH_TIMEOUT_MS);
    socket.once('message', async (raw) => {
      clearTimeout(deadline);
      const session = await this.sessionFrom(raw.toString());
      if (!session) return socket.close(LIVE_DENIED, 'Bad token');
      const peer: Peer = { ...session, id: randomUUID(), stanceAt: 0 };
      const present = this.presentIn(peer);
      this.peers.set(socket, peer);
      this.answered.add(socket);
      this.stations.set(peer.householdId, (this.stations.get(peer.householdId) ?? new Set()).add(socket));
      socket.send(JSON.stringify({ type: 'READY', serverTime: new Date().toISOString(), present } satisfies LiveServerMessage));
      socket.on('message', (data) => this.heard(peer, data.toString()));
    });
    socket.on('pong', () => this.answered.add(socket));
    socket.on('close', () => {
      clearTimeout(deadline);
      const peer = this.peers.get(socket);
      if (!peer) return;
      this.peers.delete(socket);
      const station = this.stations.get(peer.householdId);
      station?.delete(socket);
      if (!station?.size) this.stations.delete(peer.householdId);
      if (peer.stance) this.broadcast(peer.householdId, { type: 'LEFT', peer: peer.id }, peer);
    });
    socket.on('error', (e) => this.log.warn(`Connection error: ${e.message}`));
  }

  /** A signed-in player's message: where they stand now, or an emote. Anything malformed is ignored. */
  private heard(peer: Peer, text: string): void {
    let msg: LiveClientMessage;
    try {
      msg = JSON.parse(text) as LiveClientMessage;
    } catch {
      return;
    }
    if (msg?.type === 'STANCE') {
      const stance = readStance(msg.stance);
      const now = Date.now();
      // A stop always gets through (so nobody is left walking on the spot); steps only at the device's pace.
      if (!stance || (stance.moving && now - peer.stanceAt < MIN_STANCE_GAP_MS)) return;
      peer.stance = stance;
      peer.stanceAt = now;
      this.broadcast(peer.householdId, { type: 'STANCE', peer: peer.id, member: peer.member, stance }, peer);
    } else if (msg?.type === 'EMOTE' && isEmote(msg.emote) && peer.stance) {
      this.broadcast(peer.householdId, { type: 'EMOTE', peer: peer.id, emote: msg.emote }, peer);
    }
  }

  /** Everyone else in `peer`'s station who has said where they are. */
  private presentIn(peer: Pick<Peer, 'householdId' | 'member'>): Presence[] {
    const present: Presence[] = [];
    for (const socket of this.stations.get(peer.householdId) ?? []) {
      const other = this.peers.get(socket);
      if (other?.stance && other.member.id !== peer.member.id) present.push({ peer: other.id, member: other.member, stance: other.stance });
    }
    return present;
  }

  /** Drop connections that stopped answering, and close those whose session expired. */
  private checkPeers(): void {
    const now = new Date();
    for (const [socket, peer] of this.peers) {
      if (peer.expiresAt <= now) socket.close(LIVE_DENIED, 'Session expired');
      else if (!this.answered.has(socket)) socket.terminate();
      else {
        this.answered.delete(socket);
        socket.ping();
      }
    }
  }

  private async sessionFrom(text: string) {
    try {
      const msg = JSON.parse(text) as LiveClientMessage;
      return msg?.type === 'AUTH' && typeof msg.token === 'string' ? await this.sessions.liveSessionFor(msg.token) : null;
    } catch {
      return null;
    }
  }
}
