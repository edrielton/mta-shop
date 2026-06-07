import { useState } from "react";
import { useParams, useLocation, Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";
import {
  Crown, Car, Coins, Package, ArrowLeft, ShoppingCart, Zap, Shield,
  CheckCircle, Loader2, AlertCircle, QrCode, CreditCard, Copy, ExternalLink, X
} from "lucide-react";
import type { Product } from "@shared/schema";

function formatPrice(price: string | number, currency = "BRL") {
  const numPrice = typeof price === "string" ? parseFloat(price) : price;
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(numPrice);
}

function getCategoryIcon(category: string) {
  switch (category) {
    case "vip": return <Crown className="h-12 w-12" />;
    case "vehicle": return <Car className="h-12 w-12" />;
    case "coins": return <Coins className="h-12 w-12" />;
    default: return <Package className="h-12 w-12" />;
  }
}

function getCategoryColor(category: string) {
  switch (category) {
    case "vip": return "bg-amber-500/10 text-amber-500 dark:text-amber-400";
    case "vehicle": return "bg-blue-500/10 text-blue-500 dark:text-blue-400";
    case "coins": return "bg-emerald-500/10 text-emerald-500 dark:text-emerald-400";
    default: return "bg-purple-500/10 text-purple-500 dark:text-purple-400";
  }
}

// ── Modal PIX ──────────────────────────────────────────────────────────────────
function PixModal({
  open, onClose, data
}: {
  open: boolean;
  onClose: () => void;
  data: { pixQrCode?: string; pixQrCodeBase64?: string; amount: string; transactionId: string } | null;
}) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    if (!data?.pixQrCode) return;
    await navigator.clipboard.writeText(data.pixQrCode);
    setCopied(true);
    toast({ title: "Código copiado!", description: "Cole no seu banco para pagar." });
    setTimeout(() => setCopied(false), 3000);
  };

  if (!data) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <QrCode className="h-5 w-5 text-emerald-500" />
            Pagar com PIX
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* QR Code */}
          {data.pixQrCodeBase64 ? (
            <div className="flex justify-center p-4 bg-white rounded-xl border">
              <img
                src={`data:image/png;base64,${data.pixQrCodeBase64}`}
                alt="QR Code PIX"
                className="w-48 h-48"
              />
            </div>
          ) : (
            <div className="flex items-center justify-center h-48 bg-muted rounded-xl">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          )}

          {/* Valor */}
          <div className="text-center">
            <p className="text-sm text-muted-foreground">Total a pagar</p>
            <p className="text-2xl font-bold text-emerald-500">
              {formatPrice(data.amount)}
            </p>
          </div>

          {/* Copia e cola */}
          {data.pixQrCode && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground text-center">Ou copie o código PIX:</p>
              <div className="flex gap-2">
                <div className="flex-1 p-2 bg-muted rounded text-xs font-mono truncate">
                  {data.pixQrCode.slice(0, 40)}...
                </div>
                <Button size="sm" variant="outline" onClick={copy} className="shrink-0 gap-1">
                  <Copy className="h-3 w-3" />
                  {copied ? "Copiado!" : "Copiar"}
                </Button>
              </div>
            </div>
          )}

          {/* Instruções */}
          <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-700 dark:text-emerald-400 space-y-1">
            <p className="font-semibold">Como pagar:</p>
            <ol className="list-decimal list-inside space-y-0.5">
              <li>Abra o app do seu banco</li>
              <li>Escolha Pix → Pagar com QR Code</li>
              <li>Escaneie ou cole o código acima</li>
              <li>Confirme o pagamento</li>
            </ol>
          </div>

          <p className="text-xs text-center text-muted-foreground">
            Ref: #{data.transactionId.slice(0, 8)} · A ativação é automática após confirmação.
          </p>

          <Button variant="outline" className="w-full" onClick={onClose}>
            <X className="h-4 w-4 mr-2" />
            Fechar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Página Principal ───────────────────────────────────────────────────────────
export default function ProductDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();

  const [pixModal, setPixModal] = useState(false);
  const [pixData, setPixData] = useState<{
    pixQrCode?: string; pixQrCodeBase64?: string; amount: string; transactionId: string;
  } | null>(null);

  const { data: product, isLoading, error } = useQuery<Product>({
    queryKey: ["/api/products", id],
    queryFn: async () => {
      const res = await fetch(`/api/products/${id}`);
      if (!res.ok) throw new Error("Produto não encontrado");
      return (await res.json()).product;
    },
    enabled: !!id,
  });

  // Checkout PIX — retorna QR Code do MP
  const pixMutation = useMutation({
    mutationFn: async (productId: string) => {
      const res = await apiRequest("POST", "/api/checkout/pix", { productId });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Falha ao criar PIX");
      }
      return res.json();
    },
    onSuccess: (data) => {
      setPixData({
        pixQrCode: data.pixQrCode,
        pixQrCodeBase64: data.pixQrCodeBase64,
        amount: product?.price || "0",
        transactionId: data.transactionId,
      });
      setPixModal(true);
    },
    onError: (error) => {
      toast({
        title: "Erro no PIX",
        description: error instanceof Error ? error.message : "Falha ao gerar PIX",
        variant: "destructive",
      });
    },
  });

  // Checkout Cartão — redireciona para Checkout Pro do MP
  const cardMutation = useMutation({
    mutationFn: async (productId: string) => {
      const res = await apiRequest("POST", "/api/checkout/card", { productId });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Falha ao criar checkout");
      }
      return res.json();
    },
    onSuccess: (data) => {
      // Redireciona para o Checkout Pro do Mercado Pago
      const url = data.checkoutUrl || data.sandboxUrl;
      if (url) window.location.href = url;
    },
    onError: (error) => {
      toast({
        title: "Erro no pagamento",
        description: error instanceof Error ? error.message : "Falha ao processar pagamento",
        variant: "destructive",
      });
    },
  });

  const requireLogin = () => {
    toast({ title: "Login necessário", description: "Faça login para comprar.", variant: "destructive" });
    setLocation("/auth");
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container max-w-5xl mx-auto px-4 py-8">
          <Skeleton className="h-8 w-32 mb-8" />
          <div className="grid lg:grid-cols-2 gap-8">
            <Skeleton className="h-96 rounded-lg" />
            <div className="space-y-4">
              <Skeleton className="h-10 w-3/4" />
              <Skeleton className="h-6 w-1/4" />
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-destructive/10 mb-4">
            <AlertCircle className="h-8 w-8 text-destructive" />
          </div>
          <h1 className="font-display text-2xl font-bold mb-2">Produto não encontrado</h1>
          <p className="text-muted-foreground mb-4">O produto que você está procurando não existe ou foi removido</p>
          <Link href="/products">
            <Button variant="outline" className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Voltar aos Produtos
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const isPending = pixMutation.isPending || cardMutation.isPending;

  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-5xl mx-auto px-4 py-8">
        <nav className="mb-8">
          <Link href="/products">
            <Button variant="ghost" size="sm" className="gap-2" data-testid="button-back">
              <ArrowLeft className="h-4 w-4" />
              Voltar aos Produtos
            </Button>
          </Link>
        </nav>

        <div className="grid lg:grid-cols-2 gap-8 lg:gap-12">
          {/* Imagem do produto */}
          <div className="relative aspect-square bg-gradient-to-br from-muted to-muted/50 rounded-lg flex items-center justify-center">
            <div className={`p-12 rounded-full ${getCategoryColor(product.category)}`}>
              {getCategoryIcon(product.category)}
            </div>
            {product.category === "vip" && (
              <Badge className="absolute top-4 right-4 bg-amber-500 text-white px-4 py-1">POPULAR</Badge>
            )}
          </div>

          {/* Informações */}
          <div>
            <div className="mb-6">
              <Badge variant="secondary" className={`mb-4 ${getCategoryColor(product.category)}`}>
                {product.category.toUpperCase()}
              </Badge>
              <h1 className="font-display text-3xl lg:text-4xl font-bold mb-2" data-testid="text-product-name">
                {product.name}
              </h1>
              <p className="text-muted-foreground text-sm">SKU: {product.sku}</p>
            </div>

            <div className="mb-6">
              <span className="font-display text-4xl font-bold text-primary" data-testid="text-product-price">
                {formatPrice(product.price, product.currency || "BRL")}
              </span>
            </div>

            <p className="text-muted-foreground mb-6" data-testid="text-product-description">
              {product.description || "Sem descrição disponível para este produto."}
            </p>

            {/* Features */}
            <div className="space-y-3 mb-8">
              <div className="flex items-center gap-3 text-sm">
                <CheckCircle className="h-5 w-5 text-emerald-500" />
                <span>Ativação automática no servidor</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <Zap className="h-5 w-5 text-amber-500" />
                <span>Entrega instantânea após confirmação</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <Shield className="h-5 w-5 text-blue-500" />
                <span>Pagamento seguro via Mercado Pago</span>
              </div>
            </div>

            {/* Botões de pagamento */}
            <div className="space-y-3">
              {/* PIX */}
              <Button
                size="lg"
                className="w-full gap-2 text-lg h-14 bg-emerald-600 hover:bg-emerald-700 text-white"
                onClick={() => user ? pixMutation.mutate(product.id) : requireLogin()}
                disabled={isPending}
                data-testid="button-buy-pix"
              >
                {pixMutation.isPending ? (
                  <><Loader2 className="h-5 w-5 animate-spin" /> Gerando PIX...</>
                ) : (
                  <><QrCode className="h-5 w-5" /> Pagar com PIX</>
                )}
              </Button>

              {/* Cartão */}
              <Button
                size="lg"
                variant="outline"
                className="w-full gap-2 text-lg h-14"
                onClick={() => user ? cardMutation.mutate(product.id) : requireLogin()}
                disabled={isPending}
                data-testid="button-buy-card"
              >
                {cardMutation.isPending ? (
                  <><Loader2 className="h-5 w-5 animate-spin" /> Redirecionando...</>
                ) : (
                  <>
                    <CreditCard className="h-5 w-5" />
                    Pagar com Cartão
                    <ExternalLink className="h-4 w-4 opacity-50" />
                  </>
                )}
              </Button>
            </div>

            {!user && (
              <p className="text-center text-sm text-muted-foreground mt-4">
                Você precisa{" "}
                <Link href="/auth" className="text-primary underline">fazer login</Link>
                {" "}para comprar
              </p>
            )}

            {/* Mercado Pago badge */}
            <div className="flex items-center justify-center gap-2 mt-4">
              <Shield className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Pagamentos processados pelo Mercado Pago</span>
            </div>

            {/* Accordion */}
            <Accordion type="single" collapsible className="mt-8">
              <AccordionItem value="description">
                <AccordionTrigger>Descrição Completa</AccordionTrigger>
                <AccordionContent>
                  <p className="text-muted-foreground">
                    {product.description || "Este produto não possui descrição detalhada."}
                  </p>
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="activation">
                <AccordionTrigger>Como Funciona a Ativação</AccordionTrigger>
                <AccordionContent>
                  <ol className="list-decimal list-inside space-y-2 text-muted-foreground">
                    <li>Após o pagamento, seu pedido é processado automaticamente</li>
                    <li>O Mercado Pago confirma o pagamento em tempo real</li>
                    <li>Nosso sistema envia o comando de ativação para o servidor MTA</li>
                    <li>O item é creditado na sua conta do jogo em segundos</li>
                    <li>Você pode verificar o status em "Minhas Compras"</li>
                  </ol>
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="faq">
                <AccordionTrigger>Perguntas Frequentes</AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-4 text-muted-foreground">
                    <div>
                      <strong>Quanto tempo demora a ativação?</strong>
                      <p>A ativação é instantânea após a confirmação do pagamento pelo Mercado Pago.</p>
                    </div>
                    <div>
                      <strong>E se a ativação falhar?</strong>
                      <p>Nossa equipe será notificada e resolverá em até 24 horas.</p>
                    </div>
                    <div>
                      <strong>Posso pedir reembolso?</strong>
                      <p>Reembolsos são avaliados caso a caso pelo suporte.</p>
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>
        </div>
      </div>

      {/* Modal PIX */}
      <PixModal open={pixModal} onClose={() => setPixModal(false)} data={pixData} />
    </div>
  );
}
