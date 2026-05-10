import { useEffect } from "react";
import { Link, useSearch } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, Package, ArrowRight, Home, Loader2 } from "lucide-react";

export default function CheckoutSuccessPage() {
  const searchString = useSearch();
  const searchParams = new URLSearchParams(searchString);
  const sessionId = searchParams.get("session_id");

  const { data: transaction, isLoading } = useQuery({
    queryKey: ["/api/checkout/verify", sessionId],
    queryFn: async () => {
      if (!sessionId) return null;
      const res = await fetch(`/api/checkout/verify?session_id=${sessionId}`, {
        credentials: "include",
      });
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!sessionId,
  });

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="max-w-md w-full">
        <CardContent className="p-8 text-center">
          <div className="mb-6">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-emerald-500/10 mb-4">
              <CheckCircle className="h-10 w-10 text-emerald-500" />
            </div>
            <h1 className="font-display text-2xl font-bold mb-2">
              Pagamento Confirmado!
            </h1>
            <p className="text-muted-foreground">
              Sua compra foi processada com sucesso
            </p>
          </div>

          {isLoading ? (
            <div className="py-8">
              <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
              <p className="text-sm text-muted-foreground mt-4">
                Verificando pagamento...
              </p>
            </div>
          ) : transaction ? (
            <div className="space-y-4 mb-8">
              <div className="p-4 rounded-lg bg-muted/50">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-muted-foreground">Pedido</span>
                  <span className="font-mono text-sm">#{transaction.id?.slice(0, 8)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Status de Ativação</span>
                  {transaction.mtaActivationStatus === "success" ? (
                    <Badge className="bg-emerald-500/10 text-emerald-500">Ativado</Badge>
                  ) : transaction.mtaActivationStatus === "pending" ? (
                    <Badge className="bg-amber-500/10 text-amber-500">Processando</Badge>
                  ) : (
                    <Badge className="bg-blue-500/10 text-blue-500">Em fila</Badge>
                  )}
                </div>
              </div>
              
              {transaction.mtaActivationStatus === "success" ? (
                <div className="p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                  <p className="text-sm text-emerald-600 dark:text-emerald-400">
                    Seu item foi ativado automaticamente no servidor MTA!
                  </p>
                </div>
              ) : (
                <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/20">
                  <p className="text-sm text-amber-600 dark:text-amber-400">
                    A ativação será processada em instantes. Verifique seu perfil para acompanhar.
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="py-4 mb-8">
              <p className="text-sm text-muted-foreground">
                Seu pagamento foi confirmado e o item será ativado em breve.
              </p>
            </div>
          )}

          <div className="flex flex-col gap-3">
            <Link href="/dashboard">
              <Button className="w-full gap-2" data-testid="button-view-purchases">
                <Package className="h-4 w-4" />
                Ver Minhas Compras
              </Button>
            </Link>
            <Link href="/">
              <Button variant="outline" className="w-full gap-2" data-testid="button-back-home">
                <Home className="h-4 w-4" />
                Voltar ao Início
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
