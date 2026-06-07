import { useState, useMemo } from "react";
import { Link, useSearch } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Search, Crown, Car, Coins, Package, Filter, ArrowUpDown, X, Star, ShoppingCart, Gift,
} from "lucide-react";
import type { Product } from "@shared/schema";

function formatPrice(price: string | number, currency = "BRL") {
  const num = typeof price === "string" ? parseFloat(price) : price;
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(num);
}

function getCategoryIcon(category: string, size = "h-6 w-6") {
  switch (category) {
    case "vip":     return <Crown className={size} />;
    case "vehicle": return <Car className={size} />;
    case "coins":   return <Coins className={size} />;
    case "free":    return <Gift className={size} />;
    default:        return <Package className={size} />;
  }
}

function getCategoryGradient(category: string) {
  switch (category) {
    case "vip":     return "from-amber-500/20 to-amber-600/5";
    case "vehicle": return "from-blue-500/20 to-blue-600/5";
    case "coins":   return "from-emerald-500/20 to-emerald-600/5";
    case "free":    return "from-emerald-400/30 to-teal-500/5";
    default:        return "from-purple-500/20 to-purple-600/5";
  }
}

function getCategoryAccent(category: string) {
  switch (category) {
    case "vip":     return "text-amber-500 bg-amber-500/10 border-amber-500/20";
    case "vehicle": return "text-blue-500 bg-blue-500/10 border-blue-500/20";
    case "coins":   return "text-emerald-500 bg-emerald-500/10 border-emerald-500/20";
    case "free":    return "text-teal-500 bg-teal-500/10 border-teal-500/20";
    default:        return "text-purple-500 bg-purple-500/10 border-purple-500/20";
  }
}

const categories = [
  { value: "all",     label: "Todos",    icon: <Package className="h-4 w-4" /> },
  { value: "vip",     label: "VIP",      icon: <Crown className="h-4 w-4" /> },
  { value: "vehicle", label: "Veículos", icon: <Car className="h-4 w-4" /> },
  { value: "coins",   label: "Moedas",   icon: <Coins className="h-4 w-4" /> },
  { value: "item",    label: "Itens",    icon: <Package className="h-4 w-4" /> },
  { value: "free",    label: "Grátis 🎁", icon: <Gift className="h-4 w-4" /> },
];

function ProductCard({ product }: { product: Product }) {
  const isFree = (product as any).isFree;
  const gradient = getCategoryGradient(isFree ? "free" : product.category);
  const accent = getCategoryAccent(isFree ? "free" : product.category);

  return (
    <Card
      className={`group overflow-hidden border transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5
        ${isFree
          ? "border-emerald-500/30 hover:border-emerald-500/60 hover:shadow-emerald-500/10"
          : "border-border/50 hover:border-primary/40 hover:shadow-primary/5"}`}
      data-testid={`card-product-${product.id}`}
    >
      <div className={`relative h-44 bg-gradient-to-br ${gradient} flex items-center justify-center overflow-hidden`}>
        <div className="absolute inset-0 opacity-20">
          <div className="absolute -top-4 -right-4 w-32 h-32 rounded-full bg-white/10 blur-2xl" />
          <div className="absolute -bottom-4 -left-4 w-24 h-24 rounded-full bg-white/5 blur-xl" />
        </div>

        <div className={`relative z-10 p-5 rounded-2xl border ${accent} shadow-sm`}>
          {getCategoryIcon(isFree ? "free" : product.category)}
        </div>

        <div className="absolute top-3 left-3 flex gap-1.5 flex-wrap">
          {isFree && (
            <Badge className="bg-emerald-500 text-white border-0 text-xs font-semibold px-2 py-0.5">
              🎁 GRÁTIS
            </Badge>
          )}
          {!isFree && product.category === "vip" && (
            <Badge className="bg-amber-500 text-white border-0 text-xs font-semibold px-2 py-0.5">
              <Star className="h-2.5 w-2.5 mr-1 fill-current" /> HOT
            </Badge>
          )}
          {product.stockQuantity !== null && product.stockQuantity !== undefined && product.stockQuantity <= 5 && product.stockQuantity > 0 && (
            <Badge className="bg-red-500/90 text-white border-0 text-xs px-2 py-0.5">
              Últimas {product.stockQuantity}
            </Badge>
          )}
          {product.stockQuantity === 0 && (
            <Badge variant="secondary" className="text-xs px-2 py-0.5">Esgotado</Badge>
          )}
        </div>

        <div className={`absolute top-3 right-3 text-xs font-medium px-2 py-0.5 rounded-full border ${accent}`}>
          {isFree ? "GRÁTIS" : product.category.toUpperCase()}
        </div>
      </div>

      <CardContent className="p-5">
        <h3 className="font-semibold text-base mb-1 line-clamp-1 group-hover:text-primary transition-colors">
          {product.name}
        </h3>
        <p className="text-muted-foreground text-sm mb-4 line-clamp-2 leading-relaxed">
          {product.description || "Item exclusivo do servidor"}
        </p>

        <div className="flex items-center justify-between gap-3">
          <div>
            {isFree ? (
              <span className="font-bold text-lg text-emerald-500">Gratuito</span>
            ) : (
              <>
                <p className="text-xs text-muted-foreground">Preço</p>
                <span className="font-bold text-lg">{formatPrice(product.price, product.currency || "BRL")}</span>
              </>
            )}
          </div>
          <Link href={`/products/${product.id}`}>
            <Button
              size="sm"
              disabled={product.stockQuantity === 0}
              className={`gap-1.5 px-4 ${isFree ? "bg-emerald-600 hover:bg-emerald-700 text-white" : ""}`}
              data-testid={`button-buy-${product.id}`}
            >
              {isFree ? <Gift className="h-3.5 w-3.5" /> : <ShoppingCart className="h-3.5 w-3.5" />}
              {product.stockQuantity === 0 ? "Esgotado" : isFree ? "Resgatar" : "Comprar"}
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

function ProductSkeleton() {
  return (
    <Card className="overflow-hidden">
      <Skeleton className="h-44 w-full" />
      <CardContent className="p-5">
        <Skeleton className="h-5 w-3/4 mb-2" />
        <Skeleton className="h-4 w-full mb-1" />
        <Skeleton className="h-4 w-2/3 mb-4" />
        <div className="flex justify-between items-center">
          <Skeleton className="h-7 w-20" />
          <Skeleton className="h-9 w-24" />
        </div>
      </CardContent>
    </Card>
  );
}

export default function ProductsPage() {
  const searchString = useSearch();
  const searchParams = new URLSearchParams(searchString);
  const initialCategory = searchParams.get("category") || "all";

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState(initialCategory);
  const [sortBy, setSortBy] = useState("name");

  const { data: products, isLoading } = useQuery<Product[]>({
    queryKey: ["/api/products", category],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (category !== "all") params.set("category", category);
      const res = await fetch(`/api/products?${params}`);
      if (!res.ok) throw new Error("Failed to fetch products");
      const data = await res.json();
      return data.products;
    },
  });

  const freeProducts = useMemo(() =>
    (products || []).filter((p: any) => p.isFree),
  [products]);

  const paidProducts = useMemo(() =>
    (products || []).filter((p: any) => !p.isFree),
  [products]);

  const filteredProducts = useMemo(() => {
    let result = (category === "free" ? freeProducts : category === "all" ? paidProducts : paidProducts)
      .filter((p) =>
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        (p.description?.toLowerCase().includes(search.toLowerCase()) ?? false)
      );

    switch (sortBy) {
      case "price_asc": result = [...result].sort((a, b) => parseFloat(a.price) - parseFloat(b.price)); break;
      case "price_desc": result = [...result].sort((a, b) => parseFloat(b.price) - parseFloat(a.price)); break;
      case "newest": result = [...result].sort((a, b) => new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime()); break;
      default: result = [...result].sort((a, b) => a.name.localeCompare(b.name));
    }
    return result;
  }, [products, search, sortBy, category, freeProducts, paidProducts]);

  const hasActiveFilters = search !== "" || category !== "all";

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-background/95 backdrop-blur-sm sticky top-0 z-40">
        <div className="container max-w-7xl mx-auto px-4 py-3">
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
            <div className="flex items-baseline gap-3">
              <h1 className="font-bold text-xl">Produtos</h1>
              {!isLoading && (
                <span className="text-sm text-muted-foreground">
                  {filteredProducts.length} {filteredProducts.length === 1 ? "item" : "itens"}
                </span>
              )}
            </div>
            <div className="flex gap-2 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-60">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input placeholder="Buscar..." value={search} onChange={(e) => setSearch(e.target.value)}
                  className="pl-8 h-9 text-sm" data-testid="input-search" />
                {search && (
                  <button onClick={() => setSearch("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="w-auto h-9 gap-1.5 text-sm">
                  <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="name">Nome (A-Z)</SelectItem>
                  <SelectItem value="price_asc">Menor preço</SelectItem>
                  <SelectItem value="price_desc">Maior preço</SelectItem>
                  <SelectItem value="newest">Mais recentes</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </div>

      <div className="container max-w-7xl mx-auto px-4 py-6">
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Sidebar */}
          <aside className="lg:w-52 shrink-0">
            <div className="lg:sticky lg:top-20 space-y-4">
              <div>
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Filter className="h-3.5 w-3.5" /> Categorias
                </h3>
                <div className="space-y-0.5">
                  {categories.map((cat) => (
                    <Button key={cat.value} variant={category === cat.value ? "secondary" : "ghost"}
                      size="sm" className="w-full justify-start gap-2 h-9 text-sm"
                      onClick={() => setCategory(cat.value)}>
                      {cat.icon}
                      {cat.label}
                      {!isLoading && products && (
                        <span className="ml-auto text-xs text-muted-foreground">
                          {cat.value === "all" ? paidProducts.length
                            : cat.value === "free" ? freeProducts.length
                            : paidProducts.filter((p) => p.category === cat.value).length}
                        </span>
                      )}
                    </Button>
                  ))}
                </div>
              </div>
              {hasActiveFilters && (
                <Button variant="ghost" size="sm" className="w-full text-muted-foreground gap-2"
                  onClick={() => { setSearch(""); setCategory("all"); }}>
                  <X className="h-3.5 w-3.5" /> Limpar filtros
                </Button>
              )}
            </div>
          </aside>

          {/* Conteúdo */}
          <div className="flex-1 space-y-8">

            {/* ── Seção Itens Gratuitos (sempre visível se existirem e não estiver filtrando por outra categoria) ── */}
            {!isLoading && freeProducts.length > 0 && (category === "all" || category === "free") && !search && (
              <section>
                <div className="flex items-center gap-3 mb-4">
                  <div className="h-8 w-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                    <Gift className="h-4 w-4 text-emerald-500" />
                  </div>
                  <div>
                    <h2 className="font-bold text-lg">🎁 Itens Gratuitos</h2>
                    <p className="text-xs text-muted-foreground">Resgate sem pagar — ativação automática no servidor</p>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
                  {freeProducts.map((p) => <ProductCard key={p.id} product={p} />)}
                </div>
                {category === "all" && <div className="border-t mt-8" />}
              </section>
            )}

            {/* ── Produtos pagos / resultados de busca / filtro ── */}
            {category !== "free" && (
              <section>
                {category === "all" && freeProducts.length > 0 && !search && (
                  <h2 className="font-bold text-lg mb-4">🛒 Loja</h2>
                )}
                {isLoading ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
                    {Array.from({ length: 9 }).map((_, i) => <ProductSkeleton key={i} />)}
                  </div>
                ) : filteredProducts.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
                    {filteredProducts.map((p) => <ProductCard key={p.id} product={p} />)}
                  </div>
                ) : (
                  <div className="text-center py-20">
                    <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-muted mb-4">
                      <Package className="h-7 w-7 text-muted-foreground" />
                    </div>
                    <h3 className="font-semibold text-base mb-1">Nenhum produto encontrado</h3>
                    <p className="text-muted-foreground text-sm mb-4">
                      {search ? `Sem resultados para "${search}"` : "Nenhum item nesta categoria"}
                    </p>
                    <Button variant="outline" size="sm" onClick={() => { setSearch(""); setCategory("all"); }}>
                      Limpar filtros
                    </Button>
                  </div>
                )}
              </section>
            )}

            {/* Resultados gratuitos ao buscar */}
            {search && freeProducts.filter(p =>
              p.name.toLowerCase().includes(search.toLowerCase()) ||
              (p.description?.toLowerCase().includes(search.toLowerCase()) ?? false)
            ).length > 0 && (
              <section>
                <h2 className="font-bold text-base mb-3">🎁 Gratuitos encontrados</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
                  {freeProducts
                    .filter(p =>
                      p.name.toLowerCase().includes(search.toLowerCase()) ||
                      (p.description?.toLowerCase().includes(search.toLowerCase()) ?? false)
                    )
                    .map((p) => <ProductCard key={p.id} product={p} />)}
                </div>
              </section>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}
