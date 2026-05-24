/**
 * Página exibida quando alguém tenta acessar /admin
 * de um IP não autorizado (o backend retorna 404,
 * mas caso o React Router intercepte antes).
 */
export default function AdminBlockedPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-3">
        <p className="text-6xl font-bold text-muted-foreground">404</p>
        <p className="text-muted-foreground">Página não encontrada.</p>
      </div>
    </div>
  );
}
