import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Zap,
  Shield,
  Clock,
  CreditCard,
  Car,
  Coins,
  Crown,
  Package,
  CheckCircle,
  ArrowRight,
  Users,
  TrendingUp
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { Animated, StaggerContainer, StaggerItem, GlowPulse } from "@/components/animated";
import type { Product } from "@shared/schema";

function formatPrice(price: string | number, currency = "BRL") {
  const numPrice = typeof price === "string" ? parseFloat(price) : price;
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency,
  }).format(numPrice);
}

function getCategoryIcon(category: string) {
  switch (category) {
    case "vip":
      return <Crown className="h-5 w-5" />;
    case "vehicle":
      return <Car className="h-5 w-5" />;
    case "coins":
      return <Coins className="h-5 w-5" />;
    default:
      return <Package className="h-5 w-5" />;
  }
}

function getCategoryColor(category: string) {
  switch (category) {
    case "vip":
      return "bg-amber-500/10 text-amber-500 dark:text-amber-400";
    case "vehicle":
      return "bg-blue-500/10 text-blue-500 dark:text-blue-400";
    case "coins":
      return "bg-emerald-500/10 text-emerald-500 dark:text-emerald-400";
    default:
      return "bg-purple-500/10 text-purple-500 dark:text-purple-400";
  }
}

export default function Home() {
  const { data: products, isLoading } = useQuery<Product[]>({
    queryKey: ["/api/products"],
    queryFn: async () => {
      const res = await fetch("/api/products?limit=6");
      if (!res.ok) throw new Error("Failed to fetch products");
      const data = await res.json();
      return data.products;
    },
  });

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="relative min-h-[80vh] flex items-center justify-center overflow-x-hidden">
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-background to-background" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/10 via-transparent to-transparent" />

        {/* Animated glow orbs */}
        <GlowPulse className="absolute top-20 left-[15%] w-72 h-72 rounded-full bg-primary/5 blur-[100px]" />
        <GlowPulse className="absolute bottom-20 right-[10%] w-96 h-96 rounded-full bg-primary/5 blur-[120px]" />

        {/* Dragon */}
        <div className="absolute right-[2%] top-1/2 -translate-y-1/2 w-[600px] h-[600px] opacity-90 pointer-events-none select-none dragon-float hidden lg:block z-[1]">
          <img
            src="/images/dragon.svg"
            alt=""
            className="w-full h-full drop-shadow-[0_0_100px_rgba(99,102,241,0.6)] drop-shadow-[0_0_50px_rgba(168,85,247,0.4)] drop-shadow-[0_0_20px_rgba(99,102,241,0.3)]"
          />
          {/* Dragon glow aura */}
          <div className="absolute inset-[-25%] rounded-full bg-primary/20 blur-[120px] dragon-breath" />
        </div>

        {/* Floating particles around dragon */}
        <div className="absolute right-[15%] top-[15%] w-2.5 h-2.5 rounded-full bg-purple-400 particle-float hidden lg:block z-[2]" style={{ animationDelay: "0s", boxShadow: "0 0 10px rgba(168,85,247,0.6)" }} />
        <div className="absolute right-[25%] top-[30%] w-2 h-2 rounded-full bg-primary particle-float hidden lg:block z-[2]" style={{ animationDelay: "0.5s", boxShadow: "0 0 8px rgba(99,102,241,0.6)" }} />
        <div className="absolute right-[10%] top-[55%] w-3 h-3 rounded-full bg-indigo-400 particle-float hidden lg:block z-[2]" style={{ animationDelay: "1s", boxShadow: "0 0 12px rgba(129,140,248,0.5)" }} />
        <div className="absolute right-[20%] top-[70%] w-1.5 h-1.5 rounded-full bg-violet-500 particle-float hidden lg:block z-[2]" style={{ animationDelay: "1.5s", boxShadow: "0 0 8px rgba(168,85,247,0.6)" }} />
        <div className="absolute right-[30%] top-[40%] w-2 h-2 rounded-full bg-primary/80 particle-float hidden lg:block z-[2]" style={{ animationDelay: "2s", boxShadow: "0 0 10px rgba(99,102,241,0.5)" }} />
        <div className="absolute right-[8%] top-[45%] w-2 h-2 rounded-full bg-purple-500 particle-float hidden lg:block z-[2]" style={{ animationDelay: "2.5s", boxShadow: "0 0 12px rgba(168,85,247,0.5)" }} />

        {/* Grid pattern overlay */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.4'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          }}
        />

        <div className="container relative z-10 px-4 py-16 text-center">
          <Animated variant="scaleIn" delay={0.1}>
            <Badge
              variant="secondary"
              className="mb-6 px-4 py-1.5 text-sm font-medium"
              data-testid="badge-instant-delivery"
            >
              <Zap className="h-3.5 w-3.5 mr-1.5" />
              Ativação Instantânea
            </Badge>
          </Animated>

          <Animated variant="fadeUp" delay={0.2}>
            <h1 className="font-display text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight mb-6">
              Sua Loja de Itens
              <span className="block text-primary">MTA Server</span>
            </h1>
          </Animated>

          <Animated variant="fadeUp" delay={0.35}>
            <p className="text-muted-foreground text-lg sm:text-xl max-w-2xl mx-auto mb-8">
              Compre VIP, veículos, moedas e itens exclusivos.
              Pagamento seguro e ativação automática no servidor.
            </p>
          </Animated>

          <Animated variant="fadeUp" delay={0.5}>
            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
              <Link href="/products">
                <Button size="lg" className="gap-2 w-full sm:w-auto" data-testid="button-browse-products">
                  Ver Produtos
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link href="/auth">
                <Button size="lg" variant="outline" className="gap-2 w-full sm:w-auto" data-testid="button-login">
                  Fazer Login
                </Button>
              </Link>
            </div>
          </Animated>

          <Animated variant="fadeUp" delay={0.65}>
            <div className="flex flex-wrap justify-center gap-6 text-sm text-muted-foreground">
              {[
                { icon: <Zap className="h-4 w-4 text-primary" />, text: "Entrega Instantânea" },
                { icon: <Shield className="h-4 w-4 text-primary" />, text: "Pagamento Seguro" },
                { icon: <Clock className="h-4 w-4 text-primary" />, text: "Suporte 24/7" },
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-2">
                  {item.icon}
                  <span>{item.text}</span>
                </div>
              ))}
            </div>
          </Animated>
        </div>
      </section>

      {/* Featured Products */}
      <section className="py-20 px-4">
        <div className="container max-w-7xl mx-auto">
          <Animated variant="fadeUp">
            <div className="text-center mb-12">
              <h2 className="font-display text-3xl sm:text-4xl font-bold mb-4">
                Produtos em Destaque
              </h2>
              <p className="text-muted-foreground max-w-xl mx-auto">
                Escolha entre nossa seleção de itens populares
              </p>
            </div>
          </Animated>

          <StaggerContainer className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" stagger={0.1}>
            {isLoading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <StaggerItem key={i}>
                  <Card className="overflow-hidden">
                    <Skeleton className="h-48 w-full" />
                    <CardContent className="p-6">
                      <Skeleton className="h-6 w-3/4 mb-2" />
                      <Skeleton className="h-4 w-full mb-4" />
                      <Skeleton className="h-10 w-full" />
                    </CardContent>
                  </Card>
                </StaggerItem>
              ))
            ) : products && products.length > 0 ? (
              products.map((product) => (
                <StaggerItem key={product.id}>
                  <Card
                    className="group overflow-visible hover-elevate"
                    data-testid={`card-product-${product.id}`}
                  >
                    <div className="relative h-48 bg-gradient-to-br from-muted to-muted/50 flex items-center justify-center">
                      <div className={`p-6 rounded-full ${getCategoryColor(product.category)}`}>
                        {getCategoryIcon(product.category)}
                      </div>
                      {product.category === "vip" && (
                        <Badge
                          className="absolute top-4 right-4 bg-amber-500 text-white"
                          data-testid={`badge-hot-${product.id}`}
                        >
                          HOT
                        </Badge>
                      )}
                    </div>
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <h3 className="font-semibold text-lg">{product.name}</h3>
                        <Badge
                          variant="secondary"
                          className={`text-xs shrink-0 ${getCategoryColor(product.category)}`}
                        >
                          {product.category.toUpperCase()}
                        </Badge>
                      </div>
                      <p className="text-muted-foreground text-sm mb-4 line-clamp-2">
                        {product.description || "Sem descrição"}
                      </p>
                      <div className="flex items-center justify-between gap-4">
                        <span className="font-display font-bold text-xl">
                          {formatPrice(product.price, product.currency || "BRL")}
                        </span>
                        <Link href={`/products/${product.id}`}>
                          <Button size="sm" data-testid={`button-buy-${product.id}`}>
                            Comprar
                          </Button>
                        </Link>
                      </div>
                    </CardContent>
                  </Card>
                </StaggerItem>
              ))
            ) : (
              <div className="col-span-full text-center py-12 text-muted-foreground">
                <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Nenhum produto disponível no momento</p>
              </div>
            )}
          </StaggerContainer>

          <Animated variant="fadeUp" delay={0.2}>
            <div className="text-center mt-10">
              <Link href="/products">
                <Button variant="outline" size="lg" className="gap-2" data-testid="button-view-all">
                  Ver Todos os Produtos
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          </Animated>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 px-4 bg-muted/30">
        <div className="container max-w-5xl mx-auto">
          <Animated variant="fadeUp">
            <div className="text-center mb-16">
              <h2 className="font-display text-3xl sm:text-4xl font-bold mb-4">
                Como Funciona
              </h2>
              <p className="text-muted-foreground">
                Processo simples e rápido em 3 passos
              </p>
            </div>
          </Animated>

          <StaggerContainer className="grid md:grid-cols-3 gap-8" stagger={0.15}>
            {[
              {
                step: 1,
                icon: <Package className="h-8 w-8" />,
                title: "Escolha o Produto",
                description: "Navegue pela loja e selecione o item desejado",
              },
              {
                step: 2,
                icon: <CreditCard className="h-8 w-8" />,
                title: "Realize o Pagamento",
                description: "Pague com segurança via Mercado Pago, Pix ou cartão",
              },
              {
                step: 3,
                icon: <Zap className="h-8 w-8" />,
                title: "Ativação Automática",
                description: "Receba seu item instantaneamente no servidor",
              },
            ].map((item) => (
              <StaggerItem key={item.step}>
                <div
                  className="text-center relative"
                  data-testid={`step-${item.step}`}
                >
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 text-primary mb-6">
                    {item.icon}
                  </div>
                  <div className="absolute top-8 left-[60%] w-[80%] h-px bg-border hidden md:block last:hidden" />
                  <Badge
                    variant="secondary"
                    className="absolute -top-2 left-1/2 -translate-x-1/2 text-xs"
                  >
                    Passo {item.step}
                  </Badge>
                  <h3 className="font-semibold text-lg mb-2">{item.title}</h3>
                  <p className="text-muted-foreground text-sm">{item.description}</p>
                </div>
              </StaggerItem>
            ))}
          </StaggerContainer>
        </div>
      </section>

      {/* Stats */}
      <section className="py-20 px-4">
        <div className="container max-w-5xl mx-auto">
          <StaggerContainer className="grid grid-cols-2 md:grid-cols-4 gap-8" stagger={0.1}>
            {[
              { value: "5.000+", label: "Vendas Realizadas", icon: <TrendingUp className="h-5 w-5" /> },
              { value: "500+", label: "VIPs Ativos", icon: <Crown className="h-5 w-5" /> },
              { value: "< 1min", label: "Tempo de Ativação", icon: <Clock className="h-5 w-5" /> },
              { value: "99.9%", label: "Taxa de Sucesso", icon: <CheckCircle className="h-5 w-5" /> },
            ].map((stat, i) => (
              <StaggerItem key={i}>
                <div className="text-center" data-testid={`stat-${i}`}>
                  <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 text-primary mb-4">
                    {stat.icon}
                  </div>
                  <div className="font-display text-3xl sm:text-4xl font-bold mb-1">
                    {stat.value}
                  </div>
                  <div className="text-muted-foreground text-sm">
                    {stat.label}
                  </div>
                </div>
              </StaggerItem>
            ))}
          </StaggerContainer>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-4 bg-primary/5 relative overflow-hidden">
        <GlowPulse className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] rounded-full bg-primary/5 blur-[100px]" />
        <Animated variant="scaleIn">
          <div className="container max-w-3xl mx-auto text-center relative z-10">
            <h2 className="font-display text-3xl sm:text-4xl font-bold mb-4">
              Pronto para Começar?
            </h2>
            <p className="text-muted-foreground mb-8 max-w-xl mx-auto">
              Crie sua conta agora e tenha acesso a todos os produtos exclusivos do servidor
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/auth">
                <Button size="lg" className="gap-2 w-full sm:w-auto" data-testid="button-cta-register">
                  <Users className="h-4 w-4" />
                  Criar Conta Grátis
                </Button>
              </Link>
              <Link href="/products">
                <Button size="lg" variant="outline" className="gap-2 w-full sm:w-auto" data-testid="button-cta-products">
                  Explorar Produtos
                </Button>
              </Link>
            </div>
          </div>
        </Animated>
      </section>

      {/* Footer */}
      <footer className="border-t py-12 px-4">
        <div className="container max-w-7xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-8">
            <div>
              <h4 className="font-display font-bold text-lg mb-4">MTA Store</h4>
              <p className="text-muted-foreground text-sm">
                A melhor loja de itens para seu servidor MTA
              </p>
            </div>
            <div>
              <h5 className="font-semibold mb-4">Produtos</h5>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link href="/products?category=vip">VIP</Link></li>
                <li><Link href="/products?category=vehicle">Veículos</Link></li>
                <li><Link href="/products?category=coins">Moedas</Link></li>
                <li><Link href="/products?category=item">Itens</Link></li>
              </ul>
            </div>
            <div>
              <h5 className="font-semibold mb-4">Suporte</h5>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link href="/faq">FAQ</Link></li>
                <li><Link href="/contact">Contato</Link></li>
                <li><Link href="/terms">Termos de Uso</Link></li>
              </ul>
            </div>
            <div>
              <h5 className="font-semibold mb-4">Pagamento Seguro</h5>
              <div className="flex gap-2">
                <Badge variant="secondary" className="text-xs">Mercado Pago</Badge>
                <Badge variant="secondary" className="text-xs">Pix</Badge>
                <Badge variant="secondary" className="text-xs">Cartão</Badge>
              </div>
            </div>
          </div>
          <div className="border-t pt-8 text-center text-sm text-muted-foreground">
            <p>&copy; {new Date().getFullYear()} MTA Server Store. Todos os direitos reservados.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
