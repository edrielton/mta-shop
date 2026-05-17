import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { XCircle, ShoppingBag, Home, HelpCircle } from "lucide-react";

export default function CheckoutCancelPage() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="max-w-md w-full">
        <CardContent className="p-8 text-center">
          <div className="mb-6">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-amber-500/10 mb-4">
              <XCircle className="h-10 w-10 text-amber-500" />
            </div>
            <h1 className="font-display text-2xl font-bold mb-2">
              Pagamento Cancelado
            </h1>
            <p className="text-muted-foreground">
              Sua compra não foi finalizada
            </p>
          </div>

          <div className="p-4 rounded-lg bg-muted/50 mb-8">
            <p className="text-sm text-muted-foreground">
              Não se preocupe, nenhum valor foi cobrado. 
              Você pode tentar novamente quando quiser.
            </p>
          </div>

          <div className="flex flex-col gap-3">
            <Link href="/products">
              <Button className="w-full gap-2" data-testid="button-back-shop">
                <ShoppingBag className="h-4 w-4" />
                Voltar à Loja
              </Button>
            </Link>
            <Link href="/">
              <Button variant="outline" className="w-full gap-2" data-testid="button-back-home">
                <Home className="h-4 w-4" />
                Voltar ao Início
              </Button>
            </Link>
          </div>

          <div className="mt-6 pt-6 border-t">
            <p className="text-sm text-muted-foreground">
              Precisa de ajuda?{" "}
              <a href="#" className="text-primary underline">
                Entre em contato
              </a>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
