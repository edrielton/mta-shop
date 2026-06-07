import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import {
  Package, Users, History, FileText, Settings, Plus, Edit, Trash2,
  RefreshCw, DollarSign, AlertTriangle, CheckCircle, Clock, Loader2,
  Shield, Server, ScanLine, Plug, Layers, Ban, UserCheck,
  QrCode, Eye, EyeOff, Wifi, WifiOff,
} from "lucide-react";
import type { Product, Transaction, User, SystemLog } from "@shared/schema";

// ── helpers ───────────────────────────────────────────────────────────────────
function fmt(price: string | number, currency = "BRL") {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency })
    .format(typeof price === "string" ? parseFloat(price) : price);
}
function fmtDate(d: string | Date | null | undefined) {
  if (!d) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
  }).format(new Date(d));
}
function StatusBadge({ s }: { s: string }) {
  const map: Record<string, string> = {
    completed: "bg-emerald-500/10 text-emerald-500",
    pending:   "bg-amber-500/10 text-amber-500",
    failed:    "bg-red-500/10 text-red-500",
    processing:"bg-blue-500/10 text-blue-500",
  };
  const labels: Record<string, string> = { completed:"Concluído", pending:"Pendente", failed:"Falhou", processing:"Processando" };
  return <Badge className={map[s] || ""}>{labels[s] || s}</Badge>;
}
function MtaBadge({ s }: { s: string }) {
  if (s === "success") return <Badge className="bg-emerald-500/10 text-emerald-500">Ativado ✓</Badge>;
  if (s === "failed")  return <Badge className="bg-red-500/10 text-red-500">Falhou</Badge>;
  return <Badge className="bg-amber-500/10 text-amber-500">Pendente</Badge>;
}
function LogBadge({ level }: { level: string }) {
  const map: Record<string, string> = {
    error: "bg-red-500/10 text-red-500",
    warn:  "bg-amber-500/10 text-amber-500",
    info:  "bg-blue-500/10 text-blue-500",
    debug: "bg-gray-500/10 text-gray-500",
  };
  return <Badge className={map[level] || ""}>{level}</Badge>;
}

// ── hooks ─────────────────────────────────────────────────────────────────────
function useAdminQuery<T>(key: string, enabled: boolean) {
  return useQuery<T>({
    queryKey: [key],
    queryFn: async () => {
      const res = await fetch(key, { credentials: "include" });
      if (res.status === 401) return null as T; // sessão expirou — não estoura
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    },
    enabled,
    refetchOnWindowFocus: false, // evita refetch no foco antes da sessão ser validada
  });
}

// ── ProductDialog ─────────────────────────────────────────────────────────────
function ProductDialog({
  open, onOpenChange, editing, onSave, saving,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing: Product | null;
  onSave: (data: Partial<Product>) => void;
  saving: boolean;
}) {
  const [isActive, setIsActive] = useState(editing?.isActive ?? true);
  const [category, setCategory] = useState(editing?.category || "item");

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    onSave({
      name:        fd.get("name") as string,
      description: fd.get("description") as string,
      sku:         fd.get("sku") as string,
      price:       fd.get("price") as string,
      category,
      mtaCommand:  fd.get("mtaCommand") as string,
      stockQuantity: fd.get("stockQuantity") ? parseInt(fd.get("stockQuantity") as string) : null,
      isActive,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? "Editar Produto" : "Novo Produto"}</DialogTitle>
          <DialogDescription>Preencha os dados do produto da loja</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome *</Label>
              <Input id="name" name="name" defaultValue={editing?.name || ""} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sku">SKU *</Label>
              <Input id="sku" name="sku" defaultValue={editing?.sku || ""} required />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Descrição</Label>
            <Textarea id="description" name="description" defaultValue={editing?.description || ""} rows={2} />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="price">Preço (R$) *</Label>
              <Input id="price" name="price" type="number" step="0.01" min="0" defaultValue={editing?.price || ""} required />
            </div>
            <div className="space-y-2">
              <Label>Categoria</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="vip">VIP</SelectItem>
                  <SelectItem value="vehicle">Veículo</SelectItem>
                  <SelectItem value="coins">Moedas</SelectItem>
                  <SelectItem value="item">Item</SelectItem>
                  <SelectItem value="skin">Skin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="stockQuantity">Estoque</Label>
              <Input id="stockQuantity" name="stockQuantity" type="number" min="0"
                defaultValue={editing?.stockQuantity ?? ""} placeholder="∞" />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="mtaCommand">Comando MTA *</Label>
            <Input id="mtaCommand" name="mtaCommand"
              placeholder="ex: giveVip30d, giveCarID32"
              defaultValue={editing?.mtaCommand || ""} required />
            <p className="text-xs text-muted-foreground">Comando executado no servidor após pagamento confirmado</p>
          </div>
          <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/40">
            <Switch id="isActive" checked={isActive} onCheckedChange={setIsActive} />
            <div>
              <Label htmlFor="isActive" className="cursor-pointer">Produto ativo</Label>
              <p className="text-xs text-muted-foreground">Produtos inativos não aparecem na loja</p>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editing ? "Salvar alterações" : "Criar produto"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── ProductsTab ───────────────────────────────────────────────────────────────
function ProductsTab({ isAdmin }: { isAdmin: boolean }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);

  const { data, isLoading } = useAdminQuery<{ products: Product[] }>("/api/admin/products", isAdmin);
  const products = data?.products || [];

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["/api/admin/products"] });
    qc.invalidateQueries({ queryKey: ["/api/products"] });
  };

  const createMut = useMutation({
    mutationFn: async (d: Partial<Product>) => {
      const res = await apiRequest("POST", "/api/admin/products", d);
      if (!res.ok) throw new Error((await res.json()).message);
    },
    onSuccess: () => { invalidate(); setDialogOpen(false); toast({ title: "Produto criado!" }); },
    onError: (e: Error) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const updateMut = useMutation({
    mutationFn: async ({ id, d }: { id: string; d: Partial<Product> }) => {
      const res = await apiRequest("PATCH", `/api/admin/products/${id}`, d);
      if (!res.ok) throw new Error((await res.json()).message);
    },
    onSuccess: () => { invalidate(); setDialogOpen(false); setEditing(null); toast({ title: "Produto atualizado!" }); },
    onError: (e: Error) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `/api/admin/products/${id}`);
      if (!res.ok) throw new Error((await res.json()).message);
    },
    onSuccess: () => { invalidate(); toast({ title: "Produto excluído" }); },
    onError: (e: Error) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const handleSave = (d: Partial<Product>) => {
    if (editing) updateMut.mutate({ id: editing.id, d });
    else createMut.mutate(d);
  };

  const saving = createMut.isPending || updateMut.isPending;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-4">
        <div>
          <CardTitle>Gerenciar Produtos</CardTitle>
          <CardDescription>Adicione, edite ou remova produtos da loja</CardDescription>
        </div>
        <Button className="gap-2" onClick={() => { setEditing(null); setDialogOpen(true); }}>
          <Plus className="h-4 w-4" /> Novo Produto
        </Button>
      </CardHeader>

      <ProductDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editing={editing}
        onSave={handleSave}
        saving={saving}
      />

      <CardContent>
        {isLoading ? <Skeleton className="h-64 w-full" /> : products.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Nenhum produto cadastrado</p>
            <Button className="mt-4 gap-2" onClick={() => { setEditing(null); setDialogOpen(true); }}>
              <Plus className="h-4 w-4" /> Criar primeiro produto
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Preço</TableHead>
                  <TableHead>Estoque</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Comando MTA</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {products.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.name}</TableCell>
                    <TableCell className="font-mono text-xs">{p.sku}</TableCell>
                    <TableCell><Badge variant="secondary">{p.category}</Badge></TableCell>
                    <TableCell className="font-semibold">{fmt(p.price)}</TableCell>
                    <TableCell>
                      {p.stockQuantity === null || p.stockQuantity === undefined
                        ? <span className="text-muted-foreground text-sm">∞</span>
                        : p.stockQuantity === 0
                        ? <Badge className="bg-red-500/10 text-red-500">Esgotado</Badge>
                        : <span>{p.stockQuantity}</span>}
                    </TableCell>
                    <TableCell>
                      {p.isActive
                        ? <Badge className="bg-emerald-500/10 text-emerald-500">Ativo</Badge>
                        : <Badge className="bg-gray-500/10 text-gray-500">Inativo</Badge>}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">{p.mtaCommand}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => { setEditing(p); setDialogOpen(true); }}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon"
                          onClick={() => confirm(`Excluir "${p.name}"?`) && deleteMut.mutate(p.id)}
                          disabled={deleteMut.isPending}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── OrdersTab ─────────────────────────────────────────────────────────────────
function OrdersTab({ isAdmin }: { isAdmin: boolean }) {
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data, isLoading } = useAdminQuery<{ transactions: Transaction[] }>("/api/admin/transactions", isAdmin);
  const transactions = data?.transactions || [];

  const retryMut = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("POST", `/api/admin/transactions/${id}/retry`);
      if (!res.ok) throw new Error((await res.json()).message);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/admin/transactions"] }); toast({ title: "Ativação reenviada!" }); },
    onError: (e: Error) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const confirmPixMut = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("POST", `/api/admin/transactions/${id}/confirm-pix`);
      if (!res.ok) throw new Error((await res.json()).message);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/admin/transactions"] }); toast({ title: "PIX confirmado!", description: "Ativação MTA disparada automaticamente." }); },
    onError: (e: Error) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Pedidos & Transações</CardTitle>
        <CardDescription>Histórico de compras, ativações e confirmações de pagamento</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? <Skeleton className="h-64 w-full" /> : transactions.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <History className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Nenhum pedido encontrado</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Usuário</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Método</TableHead>
                  <TableHead>Pagamento</TableHead>
                  <TableHead>Ativação MTA</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.map((tx: any) => (
                  <TableRow key={tx.id}>
                    <TableCell className="font-mono text-xs">#{tx.id.slice(0, 8)}</TableCell>
                    <TableCell className="font-mono text-xs">{tx.userId.slice(0, 8)}</TableCell>
                    <TableCell className="font-semibold">{fmt(tx.amount)}</TableCell>
                    <TableCell>
                      {tx.paymentMethod === "pix"
                        ? <Badge className="bg-emerald-500/10 text-emerald-500 gap-1"><QrCode className="h-3 w-3" />PIX</Badge>
                        : <Badge className="bg-blue-500/10 text-blue-500">Cartão</Badge>}
                    </TableCell>
                    <TableCell><StatusBadge s={tx.status} /></TableCell>
                    <TableCell><MtaBadge s={tx.mtaActivationStatus || "pending"} /></TableCell>
                    <TableCell className="text-xs">{fmtDate(tx.createdAt)}</TableCell>
                    <TableCell>
                      <div className="flex gap-1 flex-wrap">
                        {/* Confirmar PIX manualmente (pagamento pendente + método pix) */}
                        {tx.paymentMethod === "pix" && tx.status === "pending" && (
                          <Button size="sm" variant="outline" className="gap-1 h-7 text-xs"
                            onClick={() => confirm("Confirmar pagamento PIX desta transação? Isso ativará o produto no servidor MTA.") && confirmPixMut.mutate(tx.id)}
                            disabled={confirmPixMut.isPending}>
                            <CheckCircle className="h-3 w-3 text-emerald-500" /> Confirmar PIX
                          </Button>
                        )}
                        {/* Reenviar ativação MTA quando falhou */}
                        {tx.status === "completed" && tx.mtaActivationStatus === "failed" && (
                          <Button size="sm" variant="ghost" className="gap-1 h-7 text-xs"
                            onClick={() => retryMut.mutate(tx.id)}
                            disabled={retryMut.isPending}>
                            <RefreshCw className="h-3 w-3" /> Reenviar
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── UsersTab ──────────────────────────────────────────────────────────────────
function UsersTab({ isAdmin }: { isAdmin: boolean }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [suspendReason, setSuspendReason] = useState("");
  const [suspendTarget, setSuspendTarget] = useState<User | null>(null);

  const { data, isLoading } = useAdminQuery<{ users: User[] }>("/api/admin/users", isAdmin);
  const users = data?.users || [];

  const invalidate = () => qc.invalidateQueries({ queryKey: ["/api/admin/users"] });

  const suspendMut = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      const res = await apiRequest("POST", `/api/admin/users/${id}/suspend`, { reason });
      if (!res.ok) throw new Error((await res.json()).message);
    },
    onSuccess: () => { invalidate(); setSuspendTarget(null); setSuspendReason(""); toast({ title: "Usuário suspenso" }); },
    onError: (e: Error) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const unsuspendMut = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("POST", `/api/admin/users/${id}/unsuspend`);
      if (!res.ok) throw new Error((await res.json()).message);
    },
    onSuccess: () => { invalidate(); toast({ title: "Suspensão removida" }); },
    onError: (e: Error) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Usuários</CardTitle>
          <CardDescription>Gerencie contas de usuários, suspensões e permissões</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? <Skeleton className="h-64 w-full" /> : users.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nenhum usuário encontrado</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Usuário</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Serial MTA</TableHead>
                    <TableHead>VIP</TableHead>
                    <TableHead>Moedas</TableHead>
                    <TableHead>Papel</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((u: any) => (
                    <TableRow key={u.id} className={u.isSuspended ? "opacity-60" : ""}>
                      <TableCell className="font-medium">{u.username}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{u.email}</TableCell>
                      <TableCell className="font-mono text-xs">{u.mtaSerial || "—"}</TableCell>
                      <TableCell>
                        {u.isVip
                          ? <Badge className="bg-amber-500/10 text-amber-500">VIP</Badge>
                          : <Badge variant="secondary">Não</Badge>}
                      </TableCell>
                      <TableCell>{u.coinBalance || 0}</TableCell>
                      <TableCell>
                        {u.isAdmin
                          ? <Badge className="bg-primary/10 text-primary">Admin</Badge>
                          : <Badge variant="secondary">Usuário</Badge>}
                      </TableCell>
                      <TableCell>
                        {u.isSuspended
                          ? <Badge className="bg-red-500/10 text-red-500">Suspenso</Badge>
                          : <Badge className="bg-emerald-500/10 text-emerald-500">Ativo</Badge>}
                      </TableCell>
                      <TableCell>
                        {!u.isAdmin && (
                          u.isSuspended ? (
                            <Button size="sm" variant="outline" className="gap-1 h-7 text-xs"
                              onClick={() => unsuspendMut.mutate(u.id)}
                              disabled={unsuspendMut.isPending}>
                              <UserCheck className="h-3 w-3" /> Reativar
                            </Button>
                          ) : (
                            <Button size="sm" variant="ghost" className="gap-1 h-7 text-xs text-red-500 hover:text-red-600"
                              onClick={() => setSuspendTarget(u)}>
                              <Ban className="h-3 w-3" /> Suspender
                            </Button>
                          )
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal de suspensão */}
      <Dialog open={!!suspendTarget} onOpenChange={() => setSuspendTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Ban className="h-5 w-5 text-red-500" />
              Suspender {suspendTarget?.username}
            </DialogTitle>
            <DialogDescription>Informe o motivo da suspensão. O usuário será impedido de acessar a loja.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Label>Motivo (opcional)</Label>
            <Textarea value={suspendReason} onChange={e => setSuspendReason(e.target.value)}
              placeholder="Ex: Violação dos termos de uso, chargedback, etc." rows={3} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSuspendTarget(null)}>Cancelar</Button>
            <Button variant="destructive" disabled={suspendMut.isPending}
              onClick={() => suspendTarget && suspendMut.mutate({ id: suspendTarget.id, reason: suspendReason })}>
              {suspendMut.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirmar suspensão
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ── LogsTab ───────────────────────────────────────────────────────────────────
function LogsTab({ isAdmin }: { isAdmin: boolean }) {
  const [filter, setFilter] = useState("all");

  const { data, isLoading, refetch } = useAdminQuery<{ logs: SystemLog[] }>(
    `/api/admin/logs${filter !== "all" ? `?type=${filter}` : ""}`,
    isAdmin,
  );
  const logs = data?.logs || [];

  const types = ["all", "auth", "payment", "mta_activation", "security", "error"];

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-4">
        <div>
          <CardTitle>Logs do Sistema</CardTitle>
          <CardDescription>Atividade recente: pagamentos, ativações e segurança</CardDescription>
        </div>
        <div className="flex gap-2 items-center">
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-36 h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {types.map(t => <SelectItem key={t} value={t}>{t === "all" ? "Todos" : t}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button size="sm" variant="outline" onClick={() => refetch()}>
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? <Skeleton className="h-64 w-full" /> : logs.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Nenhum log encontrado</p>
          </div>
        ) : (
          <ScrollArea className="h-[480px]">
            <div className="space-y-1.5">
              {logs.map((log: any) => (
                <div key={log.id} className="p-3 rounded-lg bg-muted/50 flex items-start gap-3">
                  <LogBadge level={log.level} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm">{log.message}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {log.type} · {fmtDate(log.createdAt)}
                      {log.ipAddress && ` · ${log.ipAddress}`}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}

// ── SettingsTab ───────────────────────────────────────────────────────────────
function SettingsTab({ isAdmin }: { isAdmin: boolean }) {
  const { toast } = useToast();
  const [showToken, setShowToken] = useState(false);
  const [testing, setTesting] = useState(false);

  const { data } = useAdminQuery<any>("/api/admin/mta-settings", isAdmin);
  const settings = data?.settings;

  const saveMut = useMutation({
    mutationFn: async (body: any) => {
      const res = await apiRequest("POST", "/api/admin/mta-settings", body);
      if (!res.ok) throw new Error((await res.json()).message);
      return res.json();
    },
    onSuccess: () => toast({ title: "Configurações salvas!" }),
    onError: (e: Error) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    saveMut.mutate({
      serverUrl:  fd.get("serverUrl"),
      serverPort: parseInt(fd.get("serverPort") as string) || 22005,
      apiToken:   fd.get("apiToken"),
      isActive:   fd.get("isActive") === "on",
    });
  };

  const testConnection = async () => {
    setTesting(true);
    try {
      const res = await fetch("/api/admin/mta-test", { credentials: "include" });
      const d = await res.json();
      if (d.success) toast({ title: "Conexão OK!", description: "Servidor MTA respondeu corretamente." });
      else toast({ title: "Falha na conexão", description: d.message || "Servidor não respondeu", variant: "destructive" });
    } catch {
      toast({ title: "Erro de rede", variant: "destructive" });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Server className="h-5 w-5" />
            Servidor MTA
          </CardTitle>
          <CardDescription>Configure a conexão com o servidor MTA para ativação automática de produtos</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid sm:grid-cols-3 gap-4">
              <div className="sm:col-span-2 space-y-2">
                <Label htmlFor="serverUrl">URL do Servidor *</Label>
                <Input id="serverUrl" name="serverUrl" placeholder="http://192.168.1.100"
                  defaultValue={settings?.serverUrl || ""} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="serverPort">Porta HTTP</Label>
                <Input id="serverPort" name="serverPort" type="number"
                  defaultValue={settings?.serverPort || 22005} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="apiToken">Token da API (MTA_STORE_TOKEN)</Label>
              <div className="relative">
                <Input id="apiToken" name="apiToken"
                  type={showToken ? "text" : "password"}
                  placeholder="Token configurado no servidor MTA"
                  defaultValue={settings?.apiToken || ""} />
                <button type="button" onClick={() => setShowToken(p => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/40">
              <Switch id="isActive" name="isActive" defaultChecked={settings?.isActive ?? true} />
              <div>
                <Label htmlFor="isActive" className="cursor-pointer">Ativação automática habilitada</Label>
                <p className="text-xs text-muted-foreground">Quando desabilitado, pagamentos são registrados mas não ativam o produto</p>
              </div>
            </div>
            <div className="flex gap-3">
              <Button type="submit" disabled={saveMut.isPending} className="gap-2">
                {saveMut.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                Salvar configurações
              </Button>
              <Button type="button" variant="outline" onClick={testConnection} disabled={testing} className="gap-2">
                {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wifi className="h-4 w-4" />}
                Testar conexão
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <QrCode className="h-5 w-5 text-emerald-500" />
            Mercado Pago
          </CardTitle>
          <CardDescription>Status da integração com o gateway de pagamento</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/40">
              <span className="text-sm">Access Token</span>
              <Badge className={process.env.MP_ACCESS_TOKEN ? "bg-emerald-500/10 text-emerald-500" : "bg-red-500/10 text-red-500"}>
                {/* Verificado via endpoint */}
                Configurado via Railway
              </Badge>
            </div>
            <div className="p-3 rounded-lg bg-muted/40 text-xs text-muted-foreground space-y-1">
              <p>Configure as variáveis de ambiente no Railway:</p>
              <p className="font-mono">MP_ACCESS_TOKEN, MP_PUBLIC_KEY, APP_URL</p>
              <p>O webhook será recebido em: <span className="font-mono text-foreground">/api/checkout/webhook</span></p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ── ResourcesTab ──────────────────────────────────────────────────────────────
interface DetectedItem {
  resourceName: string; suggestedName: string; suggestedDesc: string;
  category: string; mtaCommand: string; mtaParams: Record<string, any>; autoDetected: boolean;
}
interface MtaResource {
  name: string; state: string; description: string; classified: string | null;
  sellable: DetectedItem[];
}
interface ScanResult {
  success: boolean; total: number; running: number; detectedItems: number;
  scannedAt: number; resources: MtaResource[]; detected: DetectedItem[];
}

function ResourcesTab() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [scan, setScan] = useState<ScanResult | null>(null);
  const [scanning, setScanning] = useState(false);
  const [search, setSearch] = useState("");
  const [view, setView] = useState<"detected" | "all">("detected");
  const [items, setItems] = useState<(DetectedItem & { editName: string; editPrice: string })[]>([]);

  async function runScan() {
    setScanning(true);
    try {
      const res = await fetch("/api/admin/mta-scan", { credentials: "include" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Erro ao escanear");
      setScan(data);
      setItems((data.detected || []).map((i: DetectedItem) => ({ ...i, editName: i.suggestedName, editPrice: "" })));
      toast({ title: "Scan concluído", description: `${data.detectedItems || 0} item(ns) detectado(s).` });
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    } finally { setScanning(false); }
  }

  async function createItem(item: DetectedItem & { editName: string; editPrice: string }) {
    if (!item.editPrice || parseFloat(item.editPrice) <= 0) {
      toast({ title: "Defina o preço", variant: "destructive" }); return;
    }
    try {
      const sku = `AUTO-${item.resourceName}-${item.mtaCommand}-${Date.now()}`;
      const res = await fetch("/api/admin/products", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: item.editName, description: item.suggestedDesc, sku,
          price: item.editPrice, currency: "BRL", category: item.category,
          mtaCommand: item.mtaCommand, mtaParams: item.mtaParams, isActive: false,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      toast({ title: "Criado!", description: `"${item.editName}" adicionado (inativo até você ativar).` });
      qc.invalidateQueries({ queryKey: ["/api/admin/products"] });
      setItems(prev => prev.filter(p => p !== item));
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
  }

  const catColor = (c: string) => ({ vip: "text-amber-500 bg-amber-500/10", vehicle: "text-blue-500 bg-blue-500/10", coins: "text-emerald-500 bg-emerald-500/10" }[c] || "text-purple-500 bg-purple-500/10");
  const stateColor = (s: string) => ({ running: "text-green-500 bg-green-500/10", loaded: "text-blue-500 bg-blue-500/10", failed: "text-red-500 bg-red-500/10" }[s] || "text-yellow-500 bg-yellow-500/10");
  const stateLabel = (s: string) => ({ running: "Rodando", loaded: "Parado", failed: "Falhou", starting: "Iniciando" }[s] || s);
  const filtered = (scan?.resources || []).filter(r => r.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2"><ScanLine className="h-5 w-5 text-primary" />Scanner de Mods</CardTitle>
              <CardDescription>Detecta VIPs, veículos, kits automaticamente. Você só define o preço.</CardDescription>
            </div>
            <Button onClick={runScan} disabled={scanning} className="gap-2">
              {scanning ? <><Loader2 className="h-4 w-4 animate-spin" />Escaneando...</> : <><ScanLine className="h-4 w-4" />Escanear</>}
            </Button>
          </div>
        </CardHeader>
        {scan && (
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { label: "Resources", value: scan.total, cls: "bg-muted/50" },
                { label: "Rodando", value: scan.running, cls: "bg-green-500/10 text-green-500" },
                { label: "Detectados", value: scan.detectedItems || 0, cls: "bg-amber-500/10 text-amber-500" },
                { label: "Pendentes", value: items.length, cls: "bg-blue-500/10 text-blue-500" },
              ].map(s => (
                <div key={s.label} className={`text-center p-3 rounded-lg ${s.cls}`}>
                  <p className="text-2xl font-bold">{s.value}</p>
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                </div>
              ))}
            </div>
          </CardContent>
        )}
      </Card>

      {scan && (
        <>
          <div className="flex gap-1 border-b">
            {(["detected", "all"] as const).map(tab => (
              <button key={tab} onClick={() => setView(tab)}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${view === tab ? "border-primary text-primary" : "border-transparent text-muted-foreground"}`}>
                {tab === "detected" ? `Detectados (${items.length})` : `Todos (${scan.total})`}
              </button>
            ))}
          </div>

          {view === "detected" && (
            <Card>
              <CardContent className="pt-6">
                {items.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">Todos os itens já foram criados!</p>
                ) : (
                  <div className="space-y-4">
                    <p className="text-sm text-muted-foreground">Defina o preço e clique em <strong>Criar</strong>. O produto fica inativo até você ativar na aba Produtos.</p>
                    {items.map((item, idx) => (
                      <div key={idx} className="border rounded-xl p-4 space-y-3">
                        <div className="flex gap-2 flex-wrap">
                          <Badge variant="outline" className={`text-xs ${catColor(item.category)}`}>{item.category.toUpperCase()}</Badge>
                          <span className="text-xs text-muted-foreground font-mono">{item.resourceName}</span>
                          {item.autoDetected && <Badge variant="secondary" className="text-xs">✓ Auto</Badge>}
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <div className="sm:col-span-2 space-y-1">
                            <label className="text-xs text-muted-foreground">Nome do produto</label>
                            <Input value={item.editName}
                              onChange={e => setItems(prev => prev.map((p, i) => i === idx ? { ...p, editName: e.target.value } : p))}
                              className="h-9" />
                          </div>
                          <div className="space-y-1">
                            <label className="text-xs text-muted-foreground">Preço (R$) *</label>
                            <Input type="number" min="0" step="0.01" placeholder="29.90" value={item.editPrice}
                              onChange={e => setItems(prev => prev.map((p, i) => i === idx ? { ...p, editPrice: e.target.value } : p))}
                              className="h-9" />
                          </div>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/40 rounded-lg px-3 py-2 font-mono">
                          <span className="text-primary">{item.mtaCommand}</span>
                          <span>{JSON.stringify(item.mtaParams)}</span>
                        </div>
                        <Button size="sm" className="w-full" onClick={() => createItem(item)}
                          disabled={!item.editPrice || parseFloat(item.editPrice) <= 0}>
                          <Plug className="h-3.5 w-3.5 mr-2" />Criar Produto
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {view === "all" && (
            <Card>
              <CardHeader>
                <Input placeholder="Buscar resource..." value={search} onChange={e => setSearch(e.target.value)} className="max-w-xs" />
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y">
                  {filtered.map(r => (
                    <div key={r.name} className="flex items-center gap-4 px-6 py-3 hover:bg-muted/30">
                      <Layers className={`h-4 w-4 shrink-0 ${r.state === "running" ? "text-green-500" : "text-muted-foreground"}`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-sm">{r.name}</span>
                          <Badge variant="outline" className={`text-xs ${stateColor(r.state)}`}>{stateLabel(r.state)}</Badge>
                          {r.classified && r.classified !== "other" && <Badge variant="secondary" className="text-xs capitalize">{r.classified}</Badge>}
                          {r.sellable && r.sellable.length > 0 && <Badge className="text-xs bg-amber-500/10 text-amber-500">{r.sellable.length} item(s)</Badge>}
                        </div>
                        <p className="text-xs text-muted-foreground truncate">{r.description || "Sem descrição"}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {!scan && !scanning && (
        <Card>
          <CardContent className="text-center py-16">
            <ScanLine className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="font-medium mb-1">Nenhum scan realizado</p>
            <p className="text-sm text-muted-foreground mb-4">Clique em "Escanear" para detectar VIPs, veículos e outros mods vendáveis.</p>
            <Button onClick={runScan}><ScanLine className="h-4 w-4 mr-2" />Escanear agora</Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ── AdminPage (root) ──────────────────────────────────────────────────────────
export default function AdminPage() {
  const { user, isLoading: authLoading } = useAuth();
  const [, setLocation] = useLocation();

  const isAdmin = !!user?.isAdmin;

  // Redirect fora do render — evita React error #300
  useEffect(() => {
    if (!authLoading && (!user || !user.isAdmin)) {
      setLocation("/");
    }
  }, [authLoading, user, setLocation]);

  const { data: statsData } = useQuery({
    queryKey: ["/api/admin/stats"],
    queryFn: async () => {
      const res = await fetch("/api/admin/stats", { credentials: "include" });
      if (res.status === 401) return null;
      if (!res.ok) return null;
      return res.json();
    },
    enabled: isAdmin,
    refetchInterval: 30_000,
    refetchOnWindowFocus: false,
  });
  const stats = statsData || {};

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAdmin) {
    return null; // useEffect cuida do redirect
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-7xl mx-auto px-4 py-8">

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="font-display text-3xl font-bold flex items-center gap-2">
              <Shield className="h-8 w-8 text-primary" />
              Painel Admin
            </h1>
            <p className="text-muted-foreground">Gerencie produtos, pedidos, usuários e configurações</p>
          </div>
          <Badge className="bg-primary/10 text-primary">{user.username}</Badge>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[
            { label: "Receita Hoje", value: fmt(stats.todayRevenue || 0), icon: <DollarSign className="h-6 w-6 text-emerald-500" />, bg: "bg-emerald-500/10" },
            { label: "Pedidos Pendentes", value: stats.pendingOrders || 0, icon: <Clock className="h-6 w-6 text-amber-500" />, bg: "bg-amber-500/10" },
            { label: "Usuários Ativos", value: stats.activeUsers || 0, icon: <Users className="h-6 w-6 text-blue-500" />, bg: "bg-blue-500/10" },
            { label: "Falhas de Ativação", value: stats.failedActivations || 0, icon: <AlertTriangle className="h-6 w-6 text-red-500" />, bg: "bg-red-500/10" },
          ].map(s => (
            <Card key={s.label}>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-muted-foreground text-sm">{s.label}</p>
                    <p className="font-display text-2xl font-bold mt-1">{s.value}</p>
                  </div>
                  <div className={`h-12 w-12 rounded-full ${s.bg} flex items-center justify-center`}>{s.icon}</div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Tabs */}
        <Tabs defaultValue="products">
          <TabsList className="flex-wrap h-auto">
            <TabsTrigger value="products"><Package className="h-4 w-4 mr-1.5" />Produtos</TabsTrigger>
            <TabsTrigger value="orders"><History className="h-4 w-4 mr-1.5" />Pedidos</TabsTrigger>
            <TabsTrigger value="users"><Users className="h-4 w-4 mr-1.5" />Usuários</TabsTrigger>
            <TabsTrigger value="logs"><FileText className="h-4 w-4 mr-1.5" />Logs</TabsTrigger>
            <TabsTrigger value="settings"><Settings className="h-4 w-4 mr-1.5" />Configurações</TabsTrigger>
            <TabsTrigger value="resources"><ScanLine className="h-4 w-4 mr-1.5" />Resources MTA</TabsTrigger>
          </TabsList>

          <div className="mt-6">
            <TabsContent value="products">  <ProductsTab isAdmin={isAdmin} /></TabsContent>
            <TabsContent value="orders">    <OrdersTab  isAdmin={isAdmin} /></TabsContent>
            <TabsContent value="users">     <UsersTab   isAdmin={isAdmin} /></TabsContent>
            <TabsContent value="logs">      <LogsTab    isAdmin={isAdmin} /></TabsContent>
            <TabsContent value="settings">  <SettingsTab isAdmin={isAdmin} /></TabsContent>
            <TabsContent value="resources"> <ResourcesTab /></TabsContent>
          </div>
        </Tabs>
      </div>
    </div>
  );
}
