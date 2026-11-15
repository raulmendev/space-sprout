import { LIVE_DENIED, type LiveClientMessage, type LiveServerMessage } from '@garden/shared';
import { Injectable, Logger, type OnApplicationBootstrap, type OnApplicationShutdown } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { WebSocket, WebSocketServer } from 'ws';
import { SessionService } from '../session/session.service';

/** How long a new connection has to send its token. */
const AUTH_TIMEOUT_MS = 5000;
/** Pings find connections that died without closing (phones sleeping, networks dropping). */
const HEARTBEAT_MS = 30_000;

interface Peer extends WebSocket {
  alive?: boolean;
  householdId?: string;
}

/**
 * The live channel: /api/live on the API's own port. Each signed-in connection joins its
 * station, and every change to that station's garden is sent to all of them. In memory: with
 * one API instance that's every connection; more instances would need a shared broadcast (Redis).
 */
@Injectable()
export class LiveService implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly log = new Logger('Live');
  private readonly stations = new Map<string, Set<Peer>>();
  private wss?: WebSocketServer;
  private heartbeat?: NodeJS.Timeout;

  constructor(
    private readonly http: HttpAdapterHost,
    private readonly sessions: SessionService,
  ) {}

  onApplicationBootstrap(): void {
    this.wss = new WebSocketServer({ server: this.http.httpAdapter.getHttpServer(), path: '/api/live', maxPayload: 4096 });
    this.wss.on('connection', (peer: Peer) => this.welcome(peer));
    this.heartbeat = setInterval(() => {
      for (const peer of this.wss?.clients ?? []) {
        const p = peer as Peer;
        if (p.alive === false) p.terminate();
        else {
          p.alive = false;
          p.ping();
        }
      }
    }, HEARTBEAT_MS);
  }

  onApplicationShutdown(): void {
    clearInterval(this.heartbeat);
    this.wss?.close();
  }

  /** Send to everyone in a station. */
  broadcast(householdId: string, message: LiveServerMessage): void {
    const peers = this.stations.get(householdId);
    if (!peers?.size) return;
    const data = JSON.stringify(message);
    for (const peer of peers) if (peer.readyState === WebSocket.OPEN) peer.send(data);
  }

  private welcome(peer: Peer): void {
    peer.alive = true;
    peer.on('pong', () => (peer.alive = true));
    const deadline = setTimeout(() => peer.close(LIVE_DENIED, 'No token'), AUTH_TIMEOUT_MS);
    peer.once('message', async (raw) => {
      clearTimeout(deadline);
      const member = await this.memberFrom(raw.toString());
      if (!member) {
        peer.send(JSON.stringify({ type: 'DENIED' } satisfies LiveServerMessage));
        return peer.close(LIVE_DENIED, 'Bad token');
      }
      peer.householdId = member.householdId;
      const peers = this.stations.get(member.householdId) ?? new Set();
      this.stations.set(member.householdId, peers.add(peer));
      peer.send(JSON.stringify({ type: 'READY', serverTime: new Date().toISOString() } satisfies LiveServerMessage));
    });
    peer.on('close', () => {
      clearTimeout(deadline);
      const peers = peer.householdId ? this.stations.get(peer.householdId) : undefined;
      peers?.delete(peer);
      if (peers && !peers.size) this.stations.delete(peer.householdId!);
    });
    peer.on('error', (e) => this.log.warn(`Connection error: ${e.message}`));
  }

  private async memberFrom(text: string) {
    try {
      const msg = JSON.parse(text) as LiveClientMessage;
      return msg?.type === 'AUTH' && typeof msg.token === 'string' ? await this.sessions.memberFor(msg.token) : null;
    } catch {
      return null;
    }
  }
}
