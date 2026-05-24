/**
 * useWebSocket.ts
 * Hook React para conectar ao WebSocket do servidor e receber
 * atualizações em tempo real.
 *
 * Uso:
 *   const { subscribe, connected } = useWebSocket();
 *
 *   useEffect(() => {
 *     const unsub = subscribe(`player:${serial}`, (data) => {
 *       setPlayerData(data);
 *     });
 *     return unsub;
 *   }, [serial]);
 */

import { useEffect, useRef, useState, useCallback } from "react";

type Handler = (data: any) => void;

// Singleton: uma só conexão WS para toda a app
let globalWs: WebSocket | null = null;
const handlers = new Map<string, Set<Handler>>(); // channel → handlers
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let isConnecting = false;

function getWsUrl(): string {
  const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${proto}//${window.location.host}/ws`;
}

function send(msg: object) {
  if (globalWs?.readyState === WebSocket.OPEN) {
    globalWs.send(JSON.stringify(msg));
  }
}

function connect() {
  if (isConnecting || globalWs?.readyState === WebSocket.OPEN) return;
  isConnecting = true;

  const ws = new WebSocket(getWsUrl());
  globalWs = ws;

  ws.onopen = () => {
    isConnecting = false;
    if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }

    // Re-subscreve todos os canais ativos
    for (const channel of handlers.keys()) {
      if (handlers.get(channel)!.size > 0) {
        send({ type: "subscribe", channel });
      }
    }

    // Notifica listeners de conexão
    window.dispatchEvent(new CustomEvent("ws:connected"));
  };

  ws.onmessage = (ev) => {
    try {
      const msg = JSON.parse(ev.data);
      if (msg.type === "update" && msg.channel) {
        const cHandlers = handlers.get(msg.channel);
        if (cHandlers) {
          for (const h of cHandlers) h(msg.data);
        }
      }
    } catch { /* ignora */ }
  };

  ws.onclose = () => {
    isConnecting = false;
    globalWs = null;
    window.dispatchEvent(new CustomEvent("ws:disconnected"));

    // Reconecta em 3 segundos
    if (!reconnectTimer) {
      reconnectTimer = setTimeout(connect, 3000);
    }
  };

  ws.onerror = () => {
    ws.close();
  };
}

// Inicia conexão ao carregar o módulo
if (typeof window !== "undefined") {
  connect();
}

// ── Hook ──────────────────────────────────────────────────────────────────

export function useWebSocket() {
  const [connected, setConnected] = useState(
    globalWs?.readyState === WebSocket.OPEN
  );

  useEffect(() => {
    const onConnected    = () => setConnected(true);
    const onDisconnected = () => setConnected(false);

    window.addEventListener("ws:connected",    onConnected);
    window.addEventListener("ws:disconnected", onDisconnected);

    return () => {
      window.removeEventListener("ws:connected",    onConnected);
      window.removeEventListener("ws:disconnected", onDisconnected);
    };
  }, []);

  /** Assina um canal e chama handler quando chegar update */
  const subscribe = useCallback((channel: string, handler: Handler) => {
    if (!handlers.has(channel)) handlers.set(channel, new Set());
    handlers.get(channel)!.add(handler);

    // Envia subscribe se já conectado
    send({ type: "subscribe", channel });

    // Retorna função de limpeza
    return () => {
      handlers.get(channel)?.delete(handler);
      if (handlers.get(channel)?.size === 0) {
        handlers.delete(channel);
      }
    };
  }, []);

  /** Autentica o cliente no servidor WS */
  const auth = useCallback((userId: string, isAdmin: boolean) => {
    send({ type: "auth", userId, isAdmin });
  }, []);

  return { connected, subscribe, auth };
}

/** Hook específico para dados de um jogador */
export function usePlayerRealtime(serial: string | undefined) {
  const { subscribe, connected } = useWebSocket();
  const [realtimeData, setRealtimeData] = useState<any>(null);
  const [lastUpdate, setLastUpdate]     = useState<Date | null>(null);

  useEffect(() => {
    if (!serial) return;

    const unsub = subscribe(`player:${serial}`, (data) => {
      setRealtimeData(data);
      setLastUpdate(new Date());
    });

    return unsub;
  }, [serial, subscribe]);

  return { realtimeData, lastUpdate, connected };
}

/** Hook para admins receberem eventos em tempo real */
export function useAdminRealtime() {
  const { subscribe, connected } = useWebSocket();
  const [events, setEvents]      = useState<{ type: string; data: any; ts: Date }[]>([]);

  useEffect(() => {
    const channels = ["admin:player_online", "admin:player_offline", "admin:stats"];

    const unsubs = channels.map((ch) =>
      subscribe(ch, (data) => {
        setEvents((prev) => [
          { type: ch.replace("admin:", ""), data, ts: new Date() },
          ...prev.slice(0, 49), // mantém últimos 50 eventos
        ]);
      })
    );

    return () => unsubs.forEach((u) => u());
  }, [subscribe]);

  return { events, connected };
}
