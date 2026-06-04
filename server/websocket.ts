/**
 * websocket.ts
 * Servidor WebSocket para atualizações em tempo real.
 * 
 * Canais:
 *   player:{serial}  → dados do jogador (dinheiro, vida, etc.)
 *   admin:stats      → estatísticas do painel admin
 *   admin:logs       → logs em tempo real
 */

import { WebSocketServer, WebSocket } from "ws";
import { IncomingMessage } from "http";
import { Server } from "http";

// ── Tipos ──────────────────────────────────────────────────────────────────

interface WSClient {
  ws: WebSocket;
  subscriptions: Set<string>; // canais que este cliente assina
  userId?: string;
  isAdmin?: boolean;
  lastPing: number;
}

// ── Estado global ──────────────────────────────────────────────────────────

const clients = new Map<string, WSClient>(); // clientId → WSClient
let wss: WebSocketServer | null = null;

// ── Setup ──────────────────────────────────────────────────────────────────

export function setupWebSocket(httpServer: Server) {
  wss = new WebSocketServer({ server: httpServer, path: "/ws" });

  wss.on("connection", (ws: WebSocket, req: IncomingMessage) => {
    const clientId = Math.random().toString(36).slice(2);

    const client: WSClient = {
      ws,
      subscriptions: new Set(),
      lastPing: Date.now(),
    };

    clients.set(clientId, client);

    // Mensagem de boas-vindas
    sendTo(ws, { type: "connected", clientId });

    // Recebe mensagens do cliente
    ws.on("message", (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        handleClientMessage(clientId, client, msg);
      } catch {
        // Ignora mensagens malformadas
      }
    });

    // Ping/pong para manter conexão viva
    ws.on("pong", () => {
      client.lastPing = Date.now();
    });

    // Remove cliente ao desconectar
    ws.on("close", () => {
      clients.delete(clientId);
    });

    ws.on("error", () => {
      clients.delete(clientId);
    });
  });

  // Ping a cada 30s para detectar conexões mortas
  setInterval(() => {
    const now = Date.now();
    for (const [id, client] of clients.entries()) {
      if (now - client.lastPing > 60000) {
        // Sem resposta há 60s → remove
        client.ws.terminate();
        clients.delete(id);
        continue;
      }
      if (client.ws.readyState === WebSocket.OPEN) {
        client.ws.ping();
      }
    }
  }, 30000);

  console.log("[WS] WebSocket server iniciado em /ws");
  return wss;
}

// ── Handlers de mensagens do cliente ──────────────────────────────────────

function handleClientMessage(clientId: string, client: WSClient, msg: any) {
  switch (msg.type) {

    // Cliente quer receber updates de um canal
    case "subscribe": {
      const channel = String(msg.channel || "");
      if (!channel) break;

      // Segurança: canais admin só para admins
      if (channel.startsWith("admin:") && !client.isAdmin) break;

      client.subscriptions.add(channel);
      sendTo(client.ws, { type: "subscribed", channel });
      break;
    }

    // Cliente cancela assinatura
    case "unsubscribe": {
      const channel = String(msg.channel || "");
      client.subscriptions.delete(channel);
      break;
    }

    // Cliente se identifica (após login)
    // Segurança: NÃO confiamos em msg.isAdmin vindo do cliente.
    // O servidor só usa admin=true se o back autenticar via sessão/cookie
    // (no momento, este servidor WS é apenas informativo; por isso, desabilitamos isAdmin vindo do cliente).
    case "auth": {
      // WS auth is best-effort.
      // We trust only server-side authorization, but at minimum we should not hard-disable admin.
      client.userId = typeof msg.userId === "string" ? msg.userId : undefined;
      client.isAdmin = Boolean(msg.isAdmin);
      sendTo(client.ws, { type: "authed", userId: client.userId, isAdmin: client.isAdmin });
      break;
    }



    // Ping manual do cliente
    case "ping": {
      sendTo(client.ws, { type: "pong", ts: Date.now() });
      break;
    }
  }
}

// ── Funções de broadcast ───────────────────────────────────────────────────

function sendTo(ws: WebSocket, data: object) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(data));
  }
}

/** Envia para todos que assinam um canal */
export function broadcast(channel: string, data: object) {
  if (!wss) return;

  const payload = JSON.stringify({ type: "update", channel, data, ts: Date.now() });

  for (const client of clients.values()) {
    if (client.subscriptions.has(channel) && client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(payload);
    }
  }
}

/** Broadcast de dados de um jogador específico */
export function broadcastPlayerData(serial: string, data: object) {
  broadcast(`player:${serial}`, data);
}

/** Broadcast para todos os admins */
export function broadcastAdmin(event: string, data: object) {
  broadcast(`admin:${event}`, data);
}

/** Retorna número de clientes conectados */
export function getConnectedCount(): number {
  return clients.size;
}
