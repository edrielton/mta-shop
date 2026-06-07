import { useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { Loader2 } from "lucide-react";

interface Props {
  children: React.ReactNode;
}

export default function AdminGuard({ children }: Props) {
  const { user, isLoading } = useAuth();
  const [, navigate] = useLocation();

  // Redirect fora do render — evita React error #300
  useEffect(() => {
    if (!isLoading && !user) {
      navigate("/auth");
    }
  }, [isLoading, user, navigate]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) return null; // useEffect cuida do redirect

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
