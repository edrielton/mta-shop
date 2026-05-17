/**
 * AdminGuard.tsx
 * Protege as rotas /admin no frontend:
 *  1. Verifica se o usuário é admin
 *  2. Verifica se a API /admin responde (backend já bloqueou por IP)
 *     Se retornar 404 → IP não autorizado → redireciona para 404
 */

import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { Loader2, ShieldAlert } from "lucide-react";

interface Props {
  children: React.ReactNode;
}

export default function AdminGuard({ children }: Props) {
  const { user, isLoading } = useAuth();
  const [, navigate]        = useLocation();
  const [checking, setChecking] = useState(true);
  const [blocked,  setBlocked]  = useState(false);

  useEffect(() => {
    // Verifica se o backend permite acesso (teste de IP)
    fetch("/api/admin/stats", { method: "GET" })
      .then((res) => {
        if (res.status === 404) {
          // IP bloqueado pelo backend
          setBlocked(true);
        }
        setChecking(false);
      })
      .catch(() => {
        setChecking(false);
      });
  }, []);

  if (isLoading || checking) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // IP bloqueado → 404 genérico
  if (blocked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-3">
          <p className="text-6xl font-bold text-muted-foreground">404</p>
          <p className="text-muted-foreground">Página não encontrada.</p>
        </div>
      </div>
    );
  }

  // Não logado → redireciona para login
  if (!user) {
    navigate("/login");
    return null;
  }

  // Logado mas não é admin → 404 (não revela que existe painel)
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
