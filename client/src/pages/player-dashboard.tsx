import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  User, Wallet, Building2, Briefcase, Star, Heart,
  Shield, Car, Package, FileText, Wifi, WifiOff,
  TrendingUp, Clock, ChevronRight, Radio,
} from "lucide-react";
import { usePlayerRealtime } from "@/lib/useWebSocket";

interface PlayerData {
  serial: string;
  online: boolean;
  nome: string;
  idade: number;
  sexo: string;
  skin: number;
  horasJogadas: number;
  dinheiro: number;
  banco: number;
  faccao: string;
  cargo: string;
  emprego: string;
  nivel: number;
  xp: number;
  vida: number;
  colete: number;
  cnh: boolean;
  rg: boolean;
  porteArma: boolean;
  veiculos: { modelo: string; placa: string; cor: string; garagem: string }[];
  inventario: { item: string; quantidade: number }[];
  propriedades: { nome: string; endereco: string; tipo: string }[];
  updatedAt: number;
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

function StatBar({ value, max = 100, color }: { value: number; max?: number; color: string }) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  return (
    <div className="w-full bg-muted rounded-full h-2">
      <div className={`h-2 rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

export default function PlayerDashboardPage() {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const [autoLogging, setAutoLogging] = useState(false);

  // Auto-login via token na URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("t");
    if (!token || user) return;

    setAutoLogging(true);
    fetch("/api/player/auto-login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.success) {
          window.location.href = "/entrar";
        } else {
          navigate("/login?erro=" + encodeURIComponent(data.message || "Token inválido"));
        }
      })
      .catch(() => navigate("/login"))
      .finally(() => setAutoLogging(false));
  }, []);

  const serial = user?.mtaSerial;
  const { realtimeData, lastUpdate, connected: wsConnected } = usePlayerRealtime(serial);

  const { data, isLoading } = useQuery<{ player: PlayerData }>({
    queryKey: ["/api/player/data"],
    // Pausa o polling quando WebSocket está ativo
    refetchInterval: wsConnected ? false : 30000,
    queryFn: async () => {
      const res = await fetch("/api/player/data");
      if (!res.ok) throw new Error("Sem dados");
      return res.json();
    },
    enabled: !!user,
    refetchInterval: 30000, // atualiza a cada 30s
  });

  if (autoLogging) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="h-10 w-10 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="font-medium">Identificando seu personagem...</p>
          <p className="text-sm text-muted-foreground">Aguarde um momento</p>
        </div>
      </div>
    );
  }

  // Dados em tempo real têm prioridade sobre os dados do banco
  const p: PlayerData | undefined = realtimeData
    ? { ...data?.player, ...realtimeData } as PlayerData
    : data?.player;

  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-6xl mx-auto px-4 py-8 space-y-6">

        {/* Header do personagem */}
        <Card className="overflow-hidden">
          <div className="h-2 bg-gradient-to-r from-primary via-primary/70 to-primary/30" />
          <CardContent className="pt-6">
            {isLoading || !p ? (
              <div className="flex gap-4">
                <Skeleton className="h-16 w-16 rounded-full" />
                <div className="space-y-2 flex-1">
                  <Skeleton className="h-6 w-48" />
                  <Skeleton className="h-4 w-32" />
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-4">
                {/* Avatar */}
                <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center text-2xl font-bold text-primary">
                  {p.nome?.charAt(0) || "?"}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h1 className="text-2xl font-bold">{p.nome || "Sem nome"}</h1>
                    {wsConnected && (
                      <Badge className="bg-primary/10 text-primary border-primary/20 text-xs">
                        <Radio className="h-2.5 w-2.5 mr-1 animate-pulse" />
                        Tempo real
                      </Badge>
                    )}
                    <Badge className={p.online
                      ? "bg-green-500/10 text-green-500 border-green-500/20"
                      : "bg-muted text-muted-foreground"}>
                      {p.online
                        ? <><Wifi className="h-3 w-3 mr-1" />Online</>
                        : <><WifiOff className="h-3 w-3 mr-1" />Offline</>}
                    </Badge>
                  </div>
                  <div className="flex flex-wrap gap-3 mt-1 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Star className="h-3.5 w-3.5" />
                      Nível {p.nivel}
                    </span>
                    <span className="flex items-center gap-1">
                      <Building2 className="h-3.5 w-3.5" />
                      {p.faccao}
                    </span>
                    <span className="flex items-center gap-1">
                      <Briefcase className="h-3.5 w-3.5" />
                      {p.emprego}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5" />
                      {p.horasJogadas}h jogadas
                    </span>
                  </div>
                </div>

                <div className="text-right">
                  <p className="text-xs text-muted-foreground">Atualizado</p>
                  <p className="text-sm font-medium">
                    {lastUpdate
                      ? lastUpdate.toLocaleTimeString("pt-BR")
                      : p.updatedAt
                        ? new Date(p.updatedAt * 1000).toLocaleTimeString("pt-BR")
                        : "—"}
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">

          {/* Economia */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Wallet className="h-4 w-4 text-emerald-500" />
                Economia
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {isLoading || !p ? (
                <><Skeleton className="h-8 w-full" /><Skeleton className="h-8 w-full" /></>
              ) : (
                <>
                  <div className="flex justify-between items-center p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/10">
                    <span className="text-sm text-muted-foreground">Bolso</span>
                    <span className="font-bold text-emerald-500">{formatMoney(p.dinheiro)}</span>
                  </div>
                  <div className="flex justify-between items-center p-3 rounded-lg bg-blue-500/5 border border-blue-500/10">
                    <span className="text-sm text-muted-foreground">Banco</span>
                    <span className="font-bold text-blue-500">{formatMoney(p.banco)}</span>
                  </div>
                  <div className="flex justify-between items-center p-3 rounded-lg bg-muted/50">
                    <span className="text-sm text-muted-foreground">Total</span>
                    <span className="font-bold">{formatMoney((p.dinheiro || 0) + (p.banco || 0))}</span>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Status */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Heart className="h-4 w-4 text-red-500" />
                Status
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {isLoading || !p ? (
                <><Skeleton className="h-8 w-full" /><Skeleton className="h-8 w-full" /></>
              ) : (
                <>
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-sm">
                      <span className="flex items-center gap-1"><Heart className="h-3.5 w-3.5 text-red-500" />Vida</span>
                      <span className="font-medium">{p.vida}/100</span>
                    </div>
                    <StatBar value={p.vida} color="bg-red-500" />
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-sm">
                      <span className="flex items-center gap-1"><Shield className="h-3.5 w-3.5 text-blue-500" />Colete</span>
                      <span className="font-medium">{p.colete}/100</span>
                    </div>
                    <StatBar value={p.colete} color="bg-blue-500" />
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-sm">
                      <span className="flex items-center gap-1"><TrendingUp className="h-3.5 w-3.5 text-amber-500" />XP Nível {p.nivel}</span>
                      <span className="font-medium">{p.xp} XP</span>
                    </div>
                    <StatBar value={p.xp % 1000} max={1000} color="bg-amber-500" />
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Documentos */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <FileText className="h-4 w-4 text-purple-500" />
                Documentos
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {isLoading || !p ? (
                <><Skeleton className="h-8 w-full" /><Skeleton className="h-8 w-full" /></>
              ) : (
                [
                  { label: "RG", value: p.rg },
                  { label: "CNH", value: p.cnh },
                  { label: "Porte de Arma", value: p.porteArma },
                ].map(({ label, value }) => (
                  <div key={label} className="flex justify-between items-center p-2.5 rounded-lg bg-muted/40">
                    <span className="text-sm">{label}</span>
                    <Badge variant={value ? "default" : "secondary"} className="text-xs">
                      {value ? "✓ Possui" : "✗ Não possui"}
                    </Badge>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          {/* Veículos */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Car className="h-4 w-4 text-orange-500" />
                Veículos ({p?.veiculos?.length || 0})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading || !p ? (
                <Skeleton className="h-24 w-full" />
              ) : p.veiculos?.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">Nenhum veículo</p>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {p.veiculos.map((v, i) => (
                    <div key={i} className="flex items-center justify-between p-2.5 rounded-lg bg-muted/40 text-sm">
                      <div>
                        <p className="font-medium">{v.modelo}</p>
                        <p className="text-xs text-muted-foreground">{v.placa} · {v.garagem}</p>
                      </div>
                      <span className="text-xs text-muted-foreground">{v.cor}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Inventário */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Package className="h-4 w-4 text-cyan-500" />
                Inventário ({p?.inventario?.length || 0} itens)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading || !p ? (
                <Skeleton className="h-24 w-full" />
              ) : p.inventario?.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">Inventário vazio</p>
              ) : (
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {p.inventario.map((item, i) => (
                    <div key={i} className="flex justify-between items-center p-2 rounded bg-muted/40 text-sm">
                      <span>{item.item}</span>
                      <Badge variant="secondary">x{item.quantidade}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Propriedades */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Building2 className="h-4 w-4 text-pink-500" />
                Propriedades ({p?.propriedades?.length || 0})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading || !p ? (
                <Skeleton className="h-24 w-full" />
              ) : p.propriedades?.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">Nenhuma propriedade</p>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {p.propriedades.map((prop, i) => (
                    <div key={i} className="p-2.5 rounded-lg bg-muted/40 text-sm">
                      <p className="font-medium">{prop.nome}</p>
                      <p className="text-xs text-muted-foreground">{prop.endereco} · {prop.tipo}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
