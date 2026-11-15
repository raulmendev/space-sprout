import { LIVE_DENIED, type LiveClientMessage, type LiveServerMessage } from '@garden/shared';
import { Injectable, Logger, type OnApplicationBootstrap, type OnApplicationShutdown } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import type { Subscription } from 'rxjs';
import { WebSocket, WebSocketServer } from 'ws';
import { SessionService } from '../session/session.service';

/** How long a new connection has to send its token. */
const AUTH_TIMEOUT_MS = 5000;
/** Pings find connections that died without closing (phones sleeping, networks dropping); expired sessions are closed then too. */
const HEARTBEAT_MS = 30_000;

/** A signed-in connection: its station, and its session (to close it when the session ends). */
interface Peer {
  householdId: string;
  tokenHash: string;
  expiresAt: Date;
}

/**
 * The live channel: /api/live on the API's own port. Each signed-in connection joins its
 * station, and every change to that station's garden is sent to all of them. In memory: with
 * one API instance that's every connection; more instances would need a shared broadcast (Redis).
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

  /** Send to everyone in a station. */
  broadcast(householdId: string, message: LiveServerMessage): void {
    const sockets = this.stations.get(householdId);
    if (!sockets?.size) return;
    const data = JSON.stringify(message);
    for (const socket of sockets) if (socket.readyState === WebSocket.OPEN) socket.send(data);
  }

  private welcome(socket: WebSocket): void {
    const deadline = setTimeout(() => socket.close(LIVE_DENIED, 'No token'), AUTH_TIMEOUT_MS);
    socket.once('message', async (raw) => {
      clearTimeout(deadline);
      const peer = await this.sessionFrom(raw.toString());
      if (!peer) return socket.close(LIVE_DENIED, 'Bad token');
      this.peers.set(socket, peer);
      this.answered.add(socket);
      this.stations.set(peer.householdId, (this.stations.get(peer.householdId) ?? new Set()).add(socket));
      socket.send(JSON.stringify({ type: 'READY', serverTime: new Date().toISOString() } satisfies LiveServerMessage));
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
    });
    socket.on('error', (e) => this.log.warn(`Connection error: ${e.message}`));
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

  private async sessionFrom(text: string): Promise<Peer | null> {
    try {
      const msg = JSON.parse(text) as LiveClientMessage;
      return msg?.type === 'AUTH' && typeof msg.token === 'string' ? await this.sessions.liveSessionFor(msg.token) : null;
    } catch {
      return null;
    }
  }
}
