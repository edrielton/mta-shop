/**
 * AdminGuard.tsx
 * Protege rotas admin: verifica se o usuário está logado e é admin.
 * Se não estiver logado → redireciona para login.
 * Se não for admin → mostra 404.
 */
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { Loader2 } from "lucide-react";

interface Props {
  children: React.ReactNode;
}

export default function AdminGuard({ children }: Props) {
  const { user, isLoading } = useAuth();
  const [, navigate] = useLocation();

  // Aguarda verificação de sessão
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Não logado → vai para login
  if (!user) {
    const loginUrl = typeof window !== "undefined" && window.location.hostname.startsWith("admin.")
      ? "/auth"
      : "/auth";
    navigate(loginUrl);
    return null;
  }

  // Logado mas não é admin → 404 genérico
  if (!user.isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-3">
          <p className="text-6xl font-bold text-muted-foreground">404</p>
          <p className="text-muted-foreground">Página não encontrada.</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
