import { useLocation, Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { 
  Crown, Package, History, Settings, Coins, ShoppingBag, CheckCircle, 
  Clock, AlertCircle, Gamepad2, LogOut, ArrowRight, RefreshCw,
  Shield, Monitor, Smartphone, KeyRound, Trash2, EyeOff, Eye,
  ShieldCheck, ShieldAlert,
} from "lucide-react";
import type { Transaction, User } from "@shared/schema";

// ── Types ──────────────────────────────────────────────────────────────────
interface SessionInfo {
  id: string;
  deviceName: string | null;
  ipAddress: string | null;
  createdAt: string | null;
  lastSeenAt: string | null;
  expiresAt: string;
  isCurrent: boolean;
}

function formatPrice(price: string | number, currency = "BRL") {
  const numPrice = typeof price === "string" ? parseFloat(price) : price;
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency,
  }).format(numPrice);
}

function formatDate(date: string | Date | null) {
  if (!date) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));
}

function getStatusBadge(status: string) {
  switch (status) {
    case "completed":
      return <Badge className="bg-emerald-500/10 text-emerald-500">Concluído</Badge>;
    case "pending":
      return <Badge className="bg-amber-500/10 text-amber-500">Pendente</Badge>;
    case "processing":
      return <Badge className="bg-blue-500/10 text-blue-500">Processando</Badge>;
    case "failed":
      return <Badge className="bg-red-500/10 text-red-500">Falhou</Badge>;
    default:
      return <Badge variant="secondary">{status}</Badge>;
  }
}

function getMtaStatusBadge(status: string) {
  switch (status) {
    case "success":
      return <Badge className="bg-emerald-500/10 text-emerald-500">Ativado</Badge>;
    case "pending":
      return <Badge className="bg-amber-500/10 text-amber-500">Pendente</Badge>;
    case "failed":
      return <Badge className="bg-red-500/10 text-red-500">Falhou</Badge>;
    default:
      return <Badge variant="secondary">{status}</Badge>;
  }
}

export default function DashboardPage() {
  const { user, logout, isLoading: authLoading } = useAuth();
  const [, setLocation] = useLocation();

  // Redirect fora do render — useEffect evita o React error #300
  useEffect(() => {
    if (!authLoading && !user) {
      setLocation("/auth");
    }
  }, [authLoading, user, setLocation]);

  const { data: transactions, isLoading: transactionsLoading } = useQuery<Transaction[]>({
    queryKey: ["/api/user/transactions"],
    queryFn: async () => {
      const res = await fetch("/api/user/transactions", { credentials: "include" });
      if (!res.ok) return [];
      const data = await res.json();
      return data.transactions;
    },
    enabled: !!user,
  });

  const { data: stats } = useQuery({
    queryKey: ["/api/user/stats"],
    queryFn: async () => {
      const res = await fetch("/api/user/stats", { credentials: "include" });
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!user,
  });

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!user) {
    return null; // useEffect cuida do redirect
  }

  const vipDaysRemaining = user.vipExpiresAt 
    ? Math.max(0, Math.ceil((new Date(user.vipExpiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : 0;

  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-6xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16">
              <AvatarFallback className="text-xl bg-primary/10 text-primary">
                {user.username.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div>
              <h1 className="font-display text-2xl font-bold" data-testid="text-username">
                Olá, {user.username}!
              </h1>
              <p className="text-muted-foreground text-sm">{user.email}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Link href="/products">
              <Button variant="outline" className="gap-2" data-testid="button-shop">
                <ShoppingBag className="h-4 w-4" />
                Loja
              </Button>
            </Link>
            <Button 
              variant="ghost" 
              className="gap-2" 
              onClick={async () => { await logout(); setLocation("/"); }}
              data-testid="button-logout"
            >
              <LogOut className="h-4 w-4" />
              Sair
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-muted-foreground text-sm">Saldo de Moedas</p>
                  <p className="font-display text-2xl font-bold" data-testid="text-coin-balance">
                    {user.coinBalance || 0}
                  </p>
                </div>
                <div className="h-12 w-12 rounded-full bg-amber-500/10 flex items-center justify-center">
                  <Coins className="h-6 w-6 text-amber-500" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-muted-foreground text-sm">Status VIP</p>
                  <p className="font-display text-2xl font-bold">
                    {user.isVip ? "Ativo" : "Inativo"}
                  </p>
                </div>
                <div className={`h-12 w-12 rounded-full flex items-center justify-center ${
                  user.isVip ? "bg-emerald-500/10" : "bg-muted"
                }`}>
                  <Crown className={`h-6 w-6 ${user.isVip ? "text-emerald-500" : "text-muted-foreground"}`} />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-muted-foreground text-sm">Total de Compras</p>
                  <p className="font-display text-2xl font-bold">
                    {stats?.totalPurchases || 0}
                  </p>
                </div>
                <div className="h-12 w-12 rounded-full bg-blue-500/10 flex items-center justify-center">
                  <Package className="h-6 w-6 text-blue-500" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-muted-foreground text-sm">Total Gasto</p>
                  <p className="font-display text-2xl font-bold">
                    {formatPrice(stats?.totalSpent || 0)}
                  </p>
                </div>
                <div className="h-12 w-12 rounded-full bg-purple-500/10 flex items-center justify-center">
                  <History className="h-6 w-6 text-purple-500" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList>
            <TabsTrigger value="overview" data-testid="tab-overview">
              <Package className="h-4 w-4 mr-2" />
              Visão Geral
            </TabsTrigger>
            <TabsTrigger value="purchases" data-testid="tab-purchases">
              <History className="h-4 w-4 mr-2" />
              Minhas Compras
            </TabsTrigger>
            <TabsTrigger value="vip" data-testid="tab-vip">
              <Crown className="h-4 w-4 mr-2" />
              Status VIP
            </TabsTrigger>
            <TabsTrigger value="account" data-testid="tab-account">
              <Settings className="h-4 w-4 mr-2" />
              Conta
            </TabsTrigger>
            <TabsTrigger value="security" data-testid="tab-security">
              <Shield className="h-4 w-4 mr-2" />
              Segurança
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Compras Recentes</CardTitle>
                <CardDescription>Suas últimas transações</CardDescription>
              </CardHeader>
              <CardContent>
                {transactionsLoading ? (
                  <div className="space-y-4">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <Skeleton key={i} className="h-16 w-full" />
                    ))}
                  </div>
                ) : transactions && transactions.length > 0 ? (
                  <div className="space-y-4">
                    {transactions.slice(0, 5).map((tx) => (
                      <div 
                        key={tx.id} 
                        className="flex items-center justify-between p-4 rounded-lg bg-muted/50"
                        data-testid={`transaction-${tx.id}`}
                      >
                        <div className="flex items-center gap-4">
                          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                            <Package className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <p className="font-medium">Pedido #{tx.id.slice(0, 8)}</p>
                            <p className="text-sm text-muted-foreground">
                              {tx.createdAt && formatDate(tx.createdAt)}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold">{formatPrice(tx.amount)}</p>
                          {getStatusBadge(tx.status)}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <ShoppingBag className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Nenhuma compra realizada ainda</p>
                    <Link href="/products">
                      <Button variant="outline" className="mt-4 gap-2">
                        Explorar Produtos
                        <ArrowRight className="h-4 w-4" />
                      </Button>
                    </Link>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Purchases Tab */}
          <TabsContent value="purchases">
            <Card>
              <CardHeader>
                <CardTitle>Histórico de Compras</CardTitle>
                <CardDescription>Todas as suas transações</CardDescription>
              </CardHeader>
              <CardContent>
                {transactionsLoading ? (
                  <Skeleton className="h-64 w-full" />
                ) : transactions && transactions.length > 0 ? (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Pedido</TableHead>
                          <TableHead>Data</TableHead>
                          <TableHead>Valor</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Ativação MTA</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {transactions.map((tx) => (
                          <TableRow key={tx.id}>
                            <TableCell className="font-mono text-sm">
                              #{tx.id.slice(0, 8)}
                            </TableCell>
                            <TableCell>
                              {tx.createdAt && formatDate(tx.createdAt)}
                            </TableCell>
                            <TableCell className="font-semibold">
                              {formatPrice(tx.amount)}
                            </TableCell>
                            <TableCell>{getStatusBadge(tx.status)}</TableCell>
                            <TableCell>
                              {getMtaStatusBadge(tx.mtaActivationStatus || "pending")}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    <History className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Nenhuma compra encontrada</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* VIP Tab */}
          <TabsContent value="vip">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Crown className="h-5 w-5 text-amber-500" />
                  Status VIP
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {user.isVip ? (
                  <>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-2xl font-bold text-emerald-500">VIP Ativo</p>
                        <p className="text-muted-foreground">
                          Expira em {vipDaysRemaining} dias
                        </p>
                      </div>
                      <div className="h-16 w-16 rounded-full bg-emerald-500/10 flex items-center justify-center">
                        <CheckCircle className="h-8 w-8 text-emerald-500" />
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-sm mb-2">
                        <span>Tempo restante</span>
                        <span>{vipDaysRemaining} / 30 dias</span>
                      </div>
                      <Progress value={(vipDaysRemaining / 30) * 100} />
                    </div>
                    <div>
                      <h4 className="font-semibold mb-3">Benefícios VIP</h4>
                      <ul className="space-y-2">
                        {[
                          "Acesso a veículos exclusivos",
                          "Bônus de moedas diário",
                          "Prioridade no suporte",
                          "Itens cosméticos especiais",
                        ].map((benefit, i) => (
                          <li key={i} className="flex items-center gap-2 text-sm">
                            <CheckCircle className="h-4 w-4 text-emerald-500" />
                            {benefit}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <Link href="/products?category=vip">
                      <Button className="w-full gap-2">
                        <RefreshCw className="h-4 w-4" />
                        Renovar VIP
                      </Button>
                    </Link>
                  </>
                ) : (
                  <div className="text-center py-8">
                    <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                      <Crown className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <h3 className="font-semibold text-lg mb-2">Você não é VIP</h3>
                    <p className="text-muted-foreground mb-6">
                      Torne-se VIP e desbloqueie benefícios exclusivos
                    </p>
                    <Link href="/products?category=vip">
                      <Button className="gap-2">
                        <Crown className="h-4 w-4" />
                        Comprar VIP
                      </Button>
                    </Link>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Account Tab */}
          <TabsContent value="account">
            <Card>
              <CardHeader>
                <CardTitle>Informações da Conta</CardTitle>
                <CardDescription>Seus dados e vinculação MTA</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid sm:grid-cols-2 gap-6">
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Usuário</label>
                    <p className="text-lg font-medium">{user.username}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Email</label>
                    <p className="text-lg font-medium">{user.email}</p>
                  </div>
                </div>

                <div className="border-t pt-6">
                  <h4 className="font-semibold mb-4 flex items-center gap-2">
                    <Gamepad2 className="h-4 w-4" />
                    Vinculação MTA
                  </h4>
                  <div className="grid sm:grid-cols-2 gap-6">
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Serial MTA</label>
                      <p className="text-lg font-medium font-mono">
                        {user.mtaSerial || "Não vinculado"}
                      </p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Conta MTA</label>
                      <p className="text-lg font-medium">
                        {user.mtaAccount || "Não vinculada"}
                      </p>
                    </div>
                  </div>
                  {(!user.mtaSerial && !user.mtaAccount) && (
                    <div className="mt-4 p-4 rounded-lg bg-amber-500/10 border border-amber-500/20">
                      <div className="flex gap-3">
                        <AlertCircle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
                        <div>
                          <p className="font-medium text-amber-600 dark:text-amber-400">
                            Vinculação pendente
                          </p>
                          <p className="text-sm text-muted-foreground">
                            Vincule sua conta MTA para ativação automática dos itens no servidor
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="border-t pt-6">
                  <p className="text-sm text-muted-foreground mb-4">
                    Conta criada em: {user.createdAt && formatDate(user.createdAt)}
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Security Tab */}
          <TabsContent value="security" className="space-y-6">
            <SecurityTab userId={user.id} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

// ── SecurityTab Component ──────────────────────────────────────────────────

function SecurityTab({ userId }: { userId: string }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [passwords, setPasswords] = useState({ current: "", newPass: "", confirm: "" });

  // Sessions
  const { data: sessionsData, isLoading: sessionsLoading } = useQuery<{ sessions: SessionInfo[] }>({
    queryKey: ["/api/user/sessions"],
    queryFn: async () => {
      const res = await fetch("/api/user/sessions", { credentials: "include" });
      if (!res.ok) return { sessions: [] };
      return res.json();
    },
  });

  const revokeSession = useMutation({
    mutationFn: async (sessionId: string) => {
      const res = await fetch(`/api/user/sessions/${sessionId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to revoke session");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user/sessions"] });
      toast({ title: "Sessão encerrada", description: "O dispositivo foi desconectado." });
    },
  });

  const revokeAllSessions = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/user/sessions", { method: "DELETE" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/user/sessions"] });
      toast({
        title: "Sessões encerradas",
        description: `${data.revokedCount} dispositivo(s) desconectado(s).`,
      });
    },
  });

  const changePassword = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/user/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: passwords.current, newPassword: passwords.newPass }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Erro ao trocar senha");
      return data;
    },
    onSuccess: (data) => {
      setPasswords({ current: "", newPass: "", confirm: "" });
      queryClient.invalidateQueries({ queryKey: ["/api/user/sessions"] });
      toast({
        title: "Senha alterada",
        description: `Senha atualizada com sucesso. ${data.sessionsRevoked > 0 ? `${data.sessionsRevoked} sessão(ões) remotas foram encerradas automaticamente.` : ""}`,
      });
    },
    onError: (err: Error) => {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    },
  });

  const sessions = sessionsData?.sessions || [];
  const otherSessions = sessions.filter((s) => !s.isCurrent);
  const currentSession = sessions.find((s) => s.isCurrent);

  const passwordValid =
    passwords.current.length >= 6 &&
    passwords.newPass.length >= 8 &&
    passwords.newPass === passwords.confirm &&
    passwords.newPass !== passwords.current;

  function getDeviceIcon(deviceName: string | null) {
    const name = (deviceName || "").toLowerCase();
    if (name.includes("android") || name.includes("ios") || name.includes("iphone"))
      return <Smartphone className="h-4 w-4" />;
    return <Monitor className="h-4 w-4" />;
  }

  

  return (
    <div className="space-y-6">

      {/* Change Password */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-primary" />
            Alterar Senha
          </CardTitle>
          <CardDescription>
            Use uma senha forte com pelo menos 8 caracteres.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 max-w-md">
          <div className="space-y-1.5">
            <Label htmlFor="current-password">Senha atual</Label>
            <div className="relative">
              <Input
                id="current-password"
                type={showCurrent ? "text" : "password"}
                value={passwords.current}
                onChange={(e) => setPasswords((p) => ({ ...p, current: e.target.value }))}
                placeholder="Sua senha atual"
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowCurrent((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="new-password">Nova senha</Label>
            <div className="relative">
              <Input
                id="new-password"
                type={showNew ? "text" : "password"}
                value={passwords.newPass}
                onChange={(e) => setPasswords((p) => ({ ...p, newPass: e.target.value }))}
                placeholder="Mínimo 8 caracteres"
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowNew((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {passwords.newPass.length > 0 && passwords.newPass.length < 8 && (
              <p className="text-xs text-destructive">Mínimo 8 caracteres</p>
            )}
            {passwords.newPass.length >= 8 && passwords.newPass === passwords.current && (
              <p className="text-xs text-destructive">A nova senha deve ser diferente da atual</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="confirm-password">Confirmar nova senha</Label>
            <div className="relative">
              <Input
                id="confirm-password"
                type={showConfirm ? "text" : "password"}
                value={passwords.confirm}
                onChange={(e) => setPasswords((p) => ({ ...p, confirm: e.target.value }))}
                placeholder="Repita a nova senha"
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowConfirm((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {passwords.confirm.length > 0 && passwords.newPass !== passwords.confirm && (
              <p className="text-xs text-destructive">As senhas não coincidem</p>
            )}
          </div>

          <Button
            onClick={() => changePassword.mutate()}
            disabled={!passwordValid || changePassword.isPending}
            className="w-full"
            data-testid="button-change-password"
          >
            {changePassword.isPending ? "Alterando..." : "Alterar Senha"}
          </Button>
        </CardContent>
      </Card>

      {/* Active Sessions */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-primary" />
                Sessões Ativas
              </CardTitle>
              <CardDescription>
                Dispositivos conectados à sua conta agora.
              </CardDescription>
            </div>
            {otherSessions.length > 0 && (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => revokeAllSessions.mutate()}
                disabled={revokeAllSessions.isPending}
                className="gap-1.5 shrink-0"
                data-testid="button-revoke-all-sessions"
              >
                <LogOut className="h-3.5 w-3.5" />
                Encerrar outros ({otherSessions.length})
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {sessionsLoading ? (
            Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 p-3 rounded-lg border">
                <Skeleton className="h-9 w-9 rounded-full" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-48" />
                </div>
              </div>
            ))
          ) : sessions.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Nenhuma sessão ativa</p>
          ) : (
            sessions.map((session) => (
              <div
                key={session.id}
                className={`flex items-center gap-3 p-3 rounded-lg border ${
                  session.isCurrent ? "bg-primary/5 border-primary/20" : "bg-muted/30"
                }`}
              >
                <div className={`p-2 rounded-full ${
                  session.isCurrent ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                }`}>
                  {getDeviceIcon(session.deviceName)}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-sm truncate">
                      {session.deviceName || "Dispositivo desconhecido"}
                    </p>
                    {session.isCurrent && (
                      <Badge className="text-xs bg-primary/10 text-primary border-primary/20 shrink-0">
                        <ShieldCheck className="h-2.5 w-2.5 mr-1" />
                        Atual
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    IP: {session.ipAddress || "desconhecido"} · Último acesso: {formatDate(session.lastSeenAt)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Criada em {formatDate(session.createdAt)}
                  </p>
                </div>

                {!session.isCurrent && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="shrink-0 text-destructive hover:text-destructive hover:bg-destructive/10 h-8 w-8"
                    onClick={() => revokeSession.mutate(session.id)}
                    disabled={revokeSession.isPending}
                    title="Encerrar esta sessão"
                    data-testid={`button-revoke-session-${session.id}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            ))
          )}

          <div className="pt-2 rounded-lg bg-amber-500/5 border border-amber-500/20 p-3">
            <div className="flex gap-2">
              <ShieldAlert className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
              <p className="text-xs text-muted-foreground">
                Se você ver um dispositivo que não reconhece, encerre a sessão imediatamente e altere sua senha.
                Ao alterar a senha, todas as sessões de outros dispositivos são encerradas automaticamente.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
