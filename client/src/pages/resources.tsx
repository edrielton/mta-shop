import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Crown, Car, Coins, Package, Gamepad2, RefreshCw,
  Search, Filter, Zap, Star, ShoppingCart,
} from "lucide-react";
import { useState, useMemo } from "react";
import { Link } from "wouter";
import { Animated, StaggerContainer, StaggerItem, GlowPulse } from "@/components/animated";

function formatPrice(price: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(price);
}

function getCategoryIcon(category: string) {
  switch (category) {
    case "vip": return <Crown className="h-5 w-5" />;
    case "vehicle": return <Car className="h-5 w-5" />;
    case "coins": return <Coins className="h-5 w-5" />;
    default: return <Package className="h-5 w-5" />;
  }
}

function getCategoryColor(category: string) {
  switch (category) {
    case "vip": return "text-amber-500 bg-amber-500/10 border-amber-500/20";
    case "vehicle": return "text-blue-500 bg-blue-500/10 border-blue-500/20";
    case "coins": return "text-emerald-500 bg-emerald-500/10 border-emerald-500/20";
    default: return "text-purple-500 bg-purple-500/10 border-purple-500/20";
  }
}

function getCategoryGradient(category: string) {
  switch (category) {
    case "vip": return "from-amber-500/20 to-amber-600/5";
    case "vehicle": return "from-blue-500/20 to-blue-600/5";
    case "coins": return "from-emerald-500/20 to-emerald-600/5";
    default: return "from-purple-500/20 to-purple-600/5";
  }
}

interface ScanItem {
  resourceName: string;
  suggestedName: string;
  suggestedDesc: string;
  category: string;
  mtaCommand: string;
  mtaParams: Record<string, unknown>;
  autoDetected: boolean;
  luaCommands: string[];
  estimatedPrice: number;
}

interface ScanData {
  success: boolean;
  total: number;
  detectedItems: number;
  scannedAt: number;
  trigger: string;
  resources: any[];
  detected: ScanItem[];
}

const categoryFilters = [
  { value: "all", label: "Todos", icon: <Package className="h-4 w-4" /> },
  { value: "vip", label: "VIP", icon: <Crown className="h-4 w-4" /> },
  { value: "vehicle", label: "Veículos", icon: <Car className="h-4 w-4" /> },
  { value: "coins", label: "Moedas", icon: <Coins className="h-4 w-4" /> },
  { value: "item", label: "Itens", icon: <Package className="h-4 w-4" /> },
];

export default function ResourcesPage() {
  const [category, setCategory] = useState("all");
  const [search, setSearch] = useState("");

  const { data: scanData, isLoading, refetch, isFetching } = useQuery<ScanData>({
    queryKey: ["/api/scan-data"],
    queryFn: async () => {
      const res = await fetch("/api/scan-data");
      if (!res.ok) throw new Error("Failed to fetch scan data");
      return res.json();
    },
  });

  const filteredItems = useMemo(() => {
    if (!scanData?.detected) return [];
    return scanData.detected.filter((item) => {
      const matchCategory = category === "all" || item.category === category;
      const matchSearch = search === "" ||
        item.suggestedName.toLowerCase().includes(search.toLowerCase()) ||
        item.resourceName.toLowerCase().includes(search.toLowerCase()) ||
        item.mtaCommand.toLowerCase().includes(search.toLowerCase());
      return matchCategory && matchSearch;
    });
  }, [scanData, category, search]);

  const stats = useMemo(() => {
    if (!scanData?.detected) return { total: 0, vip: 0, vehicle: 0, coins: 0, other: 0 };
    const items = scanData.detected;
    return {
      total: items.length,
      vip: items.filter(i => i.category === "vip").length,
      vehicle: items.filter(i => i.category === "vehicle").length,
      coins: items.filter(i => i.category === "coins").length,
      other: items.filter(i => i.category === "item" || i.category === "other").length,
    };
  }, [scanData]);

  const scannedAt = scanData?.scannedAt
    ? new Date(scanData.scannedAt * 1000).toLocaleString("pt-BR")
    : null;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-background/95 backdrop-blur-sm sticky top-0 z-40">
        <div className="container max-w-7xl mx-auto px-4 py-4">
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
            <div className="flex items-baseline gap-3">
              <h1 className="font-bold text-xl flex items-center gap-2">
                <Gamepad2 className="h-5 w-5 text-primary" />
                Resources MTA
              </h1>
              {!isLoading && scanData?.success && (
                <span className="text-sm text-muted-foreground">
                  {stats.total} itens detectados
                </span>
              )}
            </div>
            <div className="flex gap-2 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <input
                  placeholder="Buscar resource, comando..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 h-9 text-sm bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => refetch()}
                disabled={isFetching}
                className="gap-1.5"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} />
                Atualizar
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="container max-w-7xl mx-auto px-4 py-6">
        {/* Scan info banner */}
        {scanData?.success && scannedAt && (
          <Animated variant="fadeUp">
            <div className="mb-6 p-4 rounded-xl bg-primary/5 border border-primary/10 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Zap className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-medium">Último scan recebido</p>
                  <p className="text-xs text-muted-foreground">
                    {scannedAt} · {scanData.resources?.length || 0} resources · {stats.total} itens
                  </p>
                </div>
              </div>
              <Badge variant="secondary" className="text-xs">
                via {scanData.trigger || "Scanner App"}
              </Badge>
            </div>
          </Animated>
        )}

        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {Array.from({ length: 6 }).map((_, i) => (
              <Card key={i} className="overflow-hidden">
                <Skeleton className="h-40 w-full" />
                <CardContent className="p-5">
                  <Skeleton className="h-5 w-3/4 mb-2" />
                  <Skeleton className="h-4 w-full mb-2" />
                  <Skeleton className="h-8 w-1/3" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : !scanData?.success || stats.total === 0 ? (
          <Animated variant="scaleIn">
            <div className="text-center py-24">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-muted mb-4">
                <Gamepad2 className="h-8 w-8 text-muted-foreground" />
              </div>
              <h2 className="font-semibold text-xl mb-2">Nenhum scan recebido</h2>
              <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                Execute o <strong>MTA Store Scanner</strong> (app desktop ou HTML) e clique em "Enviar pro Site" para visualizar os recursos aqui.
              </p>
              <div className="flex gap-3 justify-center">
                <Link href="/products">
                  <Button variant="outline" className="gap-2">
                    <ShoppingCart className="h-4 w-4" />
                    Ver Loja
                  </Button>
                </Link>
              </div>
            </div>
          </Animated>
        ) : (
          <div className="flex flex-col lg:flex-row gap-6">
            {/* Sidebar */}
            <aside className="lg:w-52 shrink-0">
              <div className="lg:sticky lg:top-20 space-y-4">
                {/* Stats */}
                <div className="grid grid-cols-2 lg:grid-cols-1 gap-2">
                  {[
                    { label: "Total", value: stats.total, color: "text-foreground" },
                    { label: "VIP", value: stats.vip, color: "text-amber-500" },
                    { label: "Veículos", value: stats.vehicle, color: "text-blue-500" },
                    { label: "Moedas", value: stats.coins, color: "text-emerald-500" },
                    { label: "Outros", value: stats.other, color: "text-purple-500" },
                  ].map((s) => (
                    <div key={s.label} className="flex items-center justify-between p-2.5 rounded-lg bg-muted/30 text-sm">
                      <span className="text-muted-foreground">{s.label}</span>
                      <span className={`font-bold ${s.color}`}>{s.value}</span>
                    </div>
                  ))}
                </div>

                {/* Categories */}
                <div>
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <Filter className="h-3.5 w-3.5" /> Categorias
                  </h3>
                  <div className="space-y-0.5">
                    {categoryFilters.map((cat) => (
                      <Button
                        key={cat.value}
                        variant={category === cat.value ? "secondary" : "ghost"}
                        size="sm"
                        className="w-full justify-start gap-2 h-9 text-sm"
                        onClick={() => setCategory(cat.value)}
                      >
                        {cat.icon}
                        {cat.label}
                        <span className="ml-auto text-xs text-muted-foreground">
                          {cat.value === "all" ? stats.total
                            : cat.value === "vip" ? stats.vip
                            : cat.value === "vehicle" ? stats.vehicle
                            : cat.value === "coins" ? stats.coins
                            : stats.other}
                        </span>
                      </Button>
                    ))}
                  </div>
                </div>
              </div>
            </aside>

            {/* Content */}
            <div className="flex-1">
              {filteredItems.length === 0 ? (
                <div className="text-center py-16">
                  <Package className="h-10 w-10 mx-auto mb-3 text-muted-foreground opacity-50" />
                  <p className="text-muted-foreground">Nenhum item encontrado</p>
                </div>
              ) : (
                <StaggerContainer className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5" stagger={0.06}>
                  {filteredItems.map((item, idx) => (
                    <StaggerItem key={idx}>
                      <Card
                        className="group overflow-hidden border border-border/50 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5 transition-all duration-300 hover:-translate-y-0.5"
                      >
                        <div className={`relative h-36 bg-gradient-to-br ${getCategoryGradient(item.category)} flex items-center justify-center overflow-hidden`}>
                          <div className="absolute inset-0 opacity-20">
                            <div className="absolute -top-4 -right-4 w-28 h-28 rounded-full bg-white/10 blur-2xl" />
                            <div className="absolute -bottom-4 -left-4 w-20 h-20 rounded-full bg-white/5 blur-xl" />
                          </div>
                          <div className={`relative z-10 p-4 rounded-2xl border ${getCategoryColor(item.category)} shadow-sm`}>
                            {getCategoryIcon(item.category)}
                          </div>

                          <div className="absolute top-3 left-3 flex gap-1.5">
                            {item.autoDetected && (
                              <Badge className="bg-emerald-500 text-white border-0 text-[10px] font-semibold px-2 py-0.5">
                                <Star className="h-2.5 w-2.5 mr-0.5 fill-current" /> Auto
                              </Badge>
                            )}
                          </div>

                          <div className={`absolute top-3 right-3 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${getCategoryColor(item.category)}`}>
                            {item.category.toUpperCase()}
                          </div>
                        </div>

                        <CardContent className="p-4">
                          <h3 className="font-semibold text-sm mb-1 line-clamp-1 group-hover:text-primary transition-colors">
                            {item.suggestedName}
                          </h3>
                          <p className="text-muted-foreground text-xs mb-3 line-clamp-2 leading-relaxed">
                            {item.suggestedDesc || "Item detectado pelo scanner"}
                          </p>

                          <div className="flex items-center gap-2 mb-3">
                            <code className="text-[11px] font-mono bg-muted px-2 py-0.5 rounded text-amber-500">
                              /{item.mtaCommand}
                            </code>
                            {item.luaCommands?.length > 0 && (
                              <span className="text-[10px] text-muted-foreground">
                                {item.luaCommands.length} cmds
                              </span>
                            )}
                          </div>

                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Preço Estimado</p>
                              <span className="font-bold text-lg text-emerald-500">
                                {item.estimatedPrice > 0 ? formatPrice(item.estimatedPrice) : "—"}
                              </span>
                            </div>
                            <Link href="/products">
                              <Button size="sm" variant="outline" className="gap-1.5 text-xs">
                                <ShoppingCart className="h-3 w-3" />
                                Ver Loja
                              </Button>
                            </Link>
                          </div>
                        </CardContent>
                      </Card>
                    </StaggerItem>
                  ))}
                </StaggerContainer>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
