import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
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
  Package, 
  Users, 
  History, 
  FileText, 
  Settings, 
  Plus, 
  Edit, 
  Trash2, 
  RefreshCw,
  TrendingUp,
  DollarSign,
  AlertTriangle,
  CheckCircle,
  Clock,
  Loader2,
  Shield,
  Server,
  ScanLine,
  Link2,
  Play,
  Square,
  Layers,
  ChevronDown,
  ChevronUp,
  Plug
} from "lucide-react";
import type { Product, Transaction, User, SystemLog } from "@shared/schema";

function formatPrice(price: string | number, currency = "BRL") {
  const numPrice = typeof price === "string" ? parseFloat(price) : price;
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency,
  }).format(numPrice);
}

function formatDate(date: string | Date) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
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

function getLogLevelBadge(level: string) {
  switch (level) {
    case "error":
      return <Badge className="bg-red-500/10 text-red-500">Erro</Badge>;
    case "warn":
      return <Badge className="bg-amber-500/10 text-amber-500">Aviso</Badge>;
    case "info":
      return <Badge className="bg-blue-500/10 text-blue-500">Info</Badge>;
    case "debug":
      return <Badge className="bg-gray-500/10 text-gray-500">Debug</Badge>;
    default:
      return <Badge variant="secondary">{level}</Badge>;
  }
}

export default function AdminPage() {
  const { user, isLoading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [productDialogOpen, setProductDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  // Queries
  const { data: stats } = useQuery({
    queryKey: ["/api/admin/stats"],
    queryFn: async () => {
      const res = await fetch("/api/admin/stats", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch stats");
      return res.json();
    },
    enabled: !!user?.isAdmin,
  });

  const { data: products, isLoading: productsLoading } = useQuery<Product[]>({
    queryKey: ["/api/admin/products"],
    queryFn: async () => {
      const res = await fetch("/api/admin/products", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch products");
      const data = await res.json();
      return data.products;
    },
    enabled: !!user?.isAdmin,
  });

  const { data: transactions, isLoading: transactionsLoading } = useQuery<Transaction[]>({
    queryKey: ["/api/admin/transactions"],
    queryFn: async () => {
      const res = await fetch("/api/admin/transactions", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch transactions");
      const data = await res.json();
      return data.transactions;
    },
    enabled: !!user?.isAdmin,
  });

  const { data: users, isLoading: usersLoading } = useQuery<User[]>({
    queryKey: ["/api/admin/users"],
    queryFn: async () => {
      const res = await fetch("/api/admin/users", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch users");
      const data = await res.json();
      return data.users;
    },
    enabled: !!user?.isAdmin,
  });

  const { data: logs, isLoading: logsLoading } = useQuery<SystemLog[]>({
    queryKey: ["/api/admin/logs"],
    queryFn: async () => {
      const res = await fetch("/api/admin/logs", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch logs");
      const data = await res.json();
      return data.logs;
    },
    enabled: !!user?.isAdmin,
  });

  // Mutations
  const createProductMutation = useMutation({
    mutationFn: async (data: Partial<Product>) => {
      const res = await apiRequest("POST", "/api/admin/products", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/products"] });
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      setProductDialogOpen(false);
      setEditingProduct(null);
      toast({ title: "Produto criado com sucesso!" });
    },
    onError: (error) => {
      toast({ title: "Erro ao criar produto", description: error.message, variant: "destructive" });
    },
  });

  const updateProductMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Product> }) => {
      const res = await apiRequest("PATCH", `/api/admin/products/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/products"] });
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      setProductDialogOpen(false);
      setEditingProduct(null);
      toast({ title: "Produto atualizado com sucesso!" });
    },
    onError: (error) => {
      toast({ title: "Erro ao atualizar produto", description: error.message, variant: "destructive" });
    },
  });

  const deleteProductMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `/api/admin/products/${id}`, undefined);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/products"] });
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      toast({ title: "Produto excluído com sucesso!" });
    },
    onError: (error) => {
      toast({ title: "Erro ao excluir produto", description: error.message, variant: "destructive" });
    },
  });

  const retryActivationMutation = useMutation({
    mutationFn: async (transactionId: string) => {
      const res = await apiRequest("POST", `/api/admin/transactions/${transactionId}/retry`, undefined);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/transactions"] });
      toast({ title: "Ativação reenviada com sucesso!" });
    },
    onError: (error) => {
      toast({ title: "Erro ao reenviar ativação", description: error.message, variant: "destructive" });
    },
  });

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!user?.isAdmin) {
    setLocation("/");
    return null;
  }

  const handleProductSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data = {
      name: formData.get("name") as string,
      description: formData.get("description") as string,
      sku: formData.get("sku") as string,
      price: formData.get("price") as string,
      category: formData.get("category") as string,
      mtaCommand: formData.get("mtaCommand") as string,
      isActive: formData.get("isActive") === "on",
    };

    if (editingProduct) {
      updateProductMutation.mutate({ id: editingProduct.id, data });
    } else {
      createProductMutation.mutate(data);
    }
  };

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
            <p className="text-muted-foreground">Gerencie produtos, pedidos e usuários</p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-muted-foreground text-sm">Receita Hoje</p>
                  <p className="font-display text-2xl font-bold">
                    {formatPrice(stats?.todayRevenue || 0)}
                  </p>
                </div>
                <div className="h-12 w-12 rounded-full bg-emerald-500/10 flex items-center justify-center">
                  <DollarSign className="h-6 w-6 text-emerald-500" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-muted-foreground text-sm">Pedidos Pendentes</p>
                  <p className="font-display text-2xl font-bold">
                    {stats?.pendingOrders || 0}
                  </p>
                </div>
                <div className="h-12 w-12 rounded-full bg-amber-500/10 flex items-center justify-center">
                  <Clock className="h-6 w-6 text-amber-500" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-muted-foreground text-sm">Usuários Ativos</p>
                  <p className="font-display text-2xl font-bold">
                    {stats?.activeUsers || 0}
                  </p>
                </div>
                <div className="h-12 w-12 rounded-full bg-blue-500/10 flex items-center justify-center">
                  <Users className="h-6 w-6 text-blue-500" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-muted-foreground text-sm">Falhas de Ativação</p>
                  <p className="font-display text-2xl font-bold">
                    {stats?.failedActivations || 0}
                  </p>
                </div>
                <div className="h-12 w-12 rounded-full bg-red-500/10 flex items-center justify-center">
                  <AlertTriangle className="h-6 w-6 text-red-500" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="products" className="space-y-6">
          <TabsList>
            <TabsTrigger value="products" data-testid="tab-admin-products">
              <Package className="h-4 w-4 mr-2" />
              Produtos
            </TabsTrigger>
            <TabsTrigger value="orders" data-testid="tab-admin-orders">
              <History className="h-4 w-4 mr-2" />
              Pedidos
            </TabsTrigger>
            <TabsTrigger value="users" data-testid="tab-admin-users">
              <Users className="h-4 w-4 mr-2" />
              Usuários
            </TabsTrigger>
            <TabsTrigger value="logs" data-testid="tab-admin-logs">
              <FileText className="h-4 w-4 mr-2" />
              Logs
            </TabsTrigger>
            <TabsTrigger value="settings" data-testid="tab-admin-settings">
              <Settings className="h-4 w-4 mr-2" />
              Configurações
            </TabsTrigger>
            <TabsTrigger value="resources" data-testid="tab-admin-resources">
              <ScanLine className="h-4 w-4 mr-2" />
              Resources MTA
            </TabsTrigger>
          </TabsList>

          {/* Products Tab */}
          <TabsContent value="products">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-4">
                <div>
                  <CardTitle>Gerenciar Produtos</CardTitle>
                  <CardDescription>Adicione, edite ou remova produtos da loja</CardDescription>
                </div>
                <Dialog open={productDialogOpen} onOpenChange={setProductDialogOpen}>
                  <DialogTrigger asChild>
                    <Button 
                      className="gap-2" 
                      onClick={() => setEditingProduct(null)}
                      data-testid="button-add-product"
                    >
                      <Plus className="h-4 w-4" />
                      Novo Produto
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-lg">
                    <DialogHeader>
                      <DialogTitle>
                        {editingProduct ? "Editar Produto" : "Novo Produto"}
                      </DialogTitle>
                      <DialogDescription>
                        Preencha os dados do produto
                      </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleProductSubmit} className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="name">Nome</Label>
                          <Input 
                            id="name" 
                            name="name" 
                            defaultValue={editingProduct?.name || ""} 
                            required 
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="sku">SKU</Label>
                          <Input 
                            id="sku" 
                            name="sku" 
                            defaultValue={editingProduct?.sku || ""} 
                            required 
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="description">Descrição</Label>
                        <Textarea 
                          id="description" 
                          name="description" 
                          defaultValue={editingProduct?.description || ""} 
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="price">Preço (R$)</Label>
                          <Input 
                            id="price" 
                            name="price" 
                            type="number" 
                            step="0.01" 
                            defaultValue={editingProduct?.price || ""} 
                            required 
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="category">Categoria</Label>
                          <Select name="category" defaultValue={editingProduct?.category || "item"}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="vip">VIP</SelectItem>
                              <SelectItem value="vehicle">Veículo</SelectItem>
                              <SelectItem value="coins">Moedas</SelectItem>
                              <SelectItem value="item">Item</SelectItem>
                              <SelectItem value="skin">Skin</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="mtaCommand">Comando MTA</Label>
                        <Input 
                          id="mtaCommand" 
                          name="mtaCommand" 
                          placeholder="ex: giveVip30d, giveCarID32" 
                          defaultValue={editingProduct?.mtaCommand || ""} 
                          required 
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch 
                          id="isActive" 
                          name="isActive" 
                          defaultChecked={editingProduct?.isActive ?? true} 
                        />
                        <Label htmlFor="isActive">Produto ativo</Label>
                      </div>
                      <DialogFooter>
                        <Button type="submit" disabled={createProductMutation.isPending || updateProductMutation.isPending}>
                          {(createProductMutation.isPending || updateProductMutation.isPending) && (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          )}
                          {editingProduct ? "Salvar" : "Criar"}
                        </Button>
                      </DialogFooter>
                    </form>
                  </DialogContent>
                </Dialog>
              </CardHeader>
              <CardContent>
                {productsLoading ? (
                  <Skeleton className="h-64 w-full" />
                ) : products && products.length > 0 ? (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Nome</TableHead>
                          <TableHead>SKU</TableHead>
                          <TableHead>Categoria</TableHead>
                          <TableHead>Preço</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {products.map((product) => (
                          <TableRow key={product.id}>
                            <TableCell className="font-medium">{product.name}</TableCell>
                            <TableCell className="font-mono text-sm">{product.sku}</TableCell>
                            <TableCell>
                              <Badge variant="secondary">{product.category}</Badge>
                            </TableCell>
                            <TableCell>{formatPrice(product.price)}</TableCell>
                            <TableCell>
                              {product.isActive ? (
                                <Badge className="bg-emerald-500/10 text-emerald-500">Ativo</Badge>
                              ) : (
                                <Badge className="bg-gray-500/10 text-gray-500">Inativo</Badge>
                              )}
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-2">
                                <Button 
                                  variant="ghost" 
                                  size="icon"
                                  onClick={() => {
                                    setEditingProduct(product);
                                    setProductDialogOpen(true);
                                  }}
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button 
                                  variant="ghost" 
                                  size="icon"
                                  onClick={() => {
                                    if (confirm("Excluir este produto?")) {
                                      deleteProductMutation.mutate(product.id);
                                    }
                                  }}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Nenhum produto cadastrado</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Orders Tab */}
          <TabsContent value="orders">
            <Card>
              <CardHeader>
                <CardTitle>Pedidos</CardTitle>
                <CardDescription>Histórico de transações e ativações</CardDescription>
              </CardHeader>
              <CardContent>
                {transactionsLoading ? (
                  <Skeleton className="h-64 w-full" />
                ) : transactions && transactions.length > 0 ? (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>ID</TableHead>
                          <TableHead>Usuário</TableHead>
                          <TableHead>Valor</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Ativação MTA</TableHead>
                          <TableHead>Data</TableHead>
                          <TableHead>Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {transactions.map((tx) => (
                          <TableRow key={tx.id}>
                            <TableCell className="font-mono text-sm">#{tx.id.slice(0, 8)}</TableCell>
                            <TableCell>{tx.userId.slice(0, 8)}</TableCell>
                            <TableCell className="font-semibold">{formatPrice(tx.amount)}</TableCell>
                            <TableCell>{getStatusBadge(tx.status)}</TableCell>
                            <TableCell>
                              {tx.mtaActivationStatus === "failed" ? (
                                <Badge className="bg-red-500/10 text-red-500">Falhou</Badge>
                              ) : tx.mtaActivationStatus === "success" ? (
                                <Badge className="bg-emerald-500/10 text-emerald-500">Ativado</Badge>
                              ) : (
                                <Badge className="bg-amber-500/10 text-amber-500">Pendente</Badge>
                              )}
                            </TableCell>
                            <TableCell>{tx.createdAt && formatDate(tx.createdAt)}</TableCell>
                            <TableCell>
                              {tx.mtaActivationStatus === "failed" && (
                                <Button 
                                  variant="ghost" 
                                  size="sm"
                                  className="gap-1"
                                  onClick={() => retryActivationMutation.mutate(tx.id)}
                                  disabled={retryActivationMutation.isPending}
                                >
                                  <RefreshCw className="h-3 w-3" />
                                  Reenviar
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    <History className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Nenhum pedido encontrado</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Users Tab */}
          <TabsContent value="users">
            <Card>
              <CardHeader>
                <CardTitle>Usuários</CardTitle>
                <CardDescription>Gerenciar contas de usuários</CardDescription>
              </CardHeader>
              <CardContent>
                {usersLoading ? (
                  <Skeleton className="h-64 w-full" />
                ) : users && users.length > 0 ? (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Usuário</TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead>Serial MTA</TableHead>
                          <TableHead>VIP</TableHead>
                          <TableHead>Moedas</TableHead>
                          <TableHead>Admin</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {users.map((u) => (
                          <TableRow key={u.id}>
                            <TableCell className="font-medium">{u.username}</TableCell>
                            <TableCell>{u.email}</TableCell>
                            <TableCell className="font-mono text-sm">
                              {u.mtaSerial || "-"}
                            </TableCell>
                            <TableCell>
                              {u.isVip ? (
                                <Badge className="bg-emerald-500/10 text-emerald-500">Sim</Badge>
                              ) : (
                                <Badge variant="secondary">Não</Badge>
                              )}
                            </TableCell>
                            <TableCell>{u.coinBalance || 0}</TableCell>
                            <TableCell>
                              {u.isAdmin ? (
                                <Badge className="bg-primary/10 text-primary">Admin</Badge>
                              ) : (
                                <Badge variant="secondary">Usuário</Badge>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Nenhum usuário encontrado</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Logs Tab */}
          <TabsContent value="logs">
            <Card>
              <CardHeader>
                <CardTitle>Logs do Sistema</CardTitle>
                <CardDescription>Atividade recente do sistema</CardDescription>
              </CardHeader>
              <CardContent>
                {logsLoading ? (
                  <Skeleton className="h-64 w-full" />
                ) : logs && logs.length > 0 ? (
                  <ScrollArea className="h-96">
                    <div className="space-y-2">
                      {logs.map((log) => (
                        <div 
                          key={log.id} 
                          className="p-3 rounded-lg bg-muted/50 flex items-start gap-3"
                        >
                          {getLogLevelBadge(log.level)}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium">{log.message}</p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {log.type} • {log.createdAt && formatDate(log.createdAt)}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Nenhum log encontrado</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Settings Tab */}
          <TabsContent value="settings">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Server className="h-5 w-5" />
                  Configurações do Servidor MTA
                </CardTitle>
                <CardDescription>
                  Configure a conexão com o servidor MTA para ativação automática
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>URL do Servidor</Label>
                    <Input placeholder="http://seu-servidor.com" />
                  </div>
                  <div className="space-y-2">
                    <Label>Porta HTTP</Label>
                    <Input placeholder="22005" type="number" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Token de API</Label>
                  <Input placeholder="Token secreto para autenticação" type="password" />
                </div>
                <Button className="gap-2">
                  <CheckCircle className="h-4 w-4" />
                  Salvar Configurações
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Resources MTA Tab */}
          <TabsContent value="resources">
            <ResourcesTab />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

// ── ResourcesTab ─────────────────────────────────────────────────────────────

interface DetectedItem {
  resourceName:    string;
  suggestedName:   string;
  suggestedDesc:   string;
  category:        string;
  mtaCommand:      string;
  mtaParams:       Record<string, any>;
  autoDetected:    boolean;
}

interface MtaResource {
  name:        string;
  state:       string;
  description: string;
  classified:  string | null;
  sellable:    DetectedItem[];
}

interface ScanResult {
  success:       boolean;
  total:         number;
  running:       number;
  detectedItems: number;
  scannedAt:     number;
  resources:     MtaResource[];
  detected:      DetectedItem[];
}

function ResourcesTab() {
  const { toast }    = useToast();
  const qc           = useQueryClient();
  const [scan, setScan]         = useState<ScanResult | null>(null);
  const [scanning, setScanning] = useState(false);
  const [syncing, setSyncing]   = useState(false);
  const [search, setSearch]     = useState("");
  const [view, setView]         = useState<"detected"|"all">("detected");
  const [items, setItems]       = useState<(DetectedItem & { editName: string; editPrice: string })[]>([]);

  async function runScan() {
    setScanning(true);
    try {
      const res = await fetch("/api/admin/mta-scan");
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Erro ao escanear");
      setScan(data);
      setItems((data.detected || []).map((i: DetectedItem) => ({ ...i, editName: i.suggestedName, editPrice: "" })));
      toast({ title: "Scan concluído", description: `${data.detectedItems || 0} item(ns) detectado(s).` });
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    } finally { setScanning(false); }
  }

  async function autoSync() {
    setSyncing(true);
    try {
      const res  = await fetch("/api/admin/mta-auto-sync", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      toast({ title: "Sync concluído!", description: data.message });
      qc.invalidateQueries({ queryKey: ["/api/admin/products"] });
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    } finally { setSyncing(false); }
  }

  async function createItem(item: DetectedItem & { editName: string; editPrice: string }) {
    if (!item.editPrice || parseFloat(item.editPrice) <= 0) {
      toast({ title: "Defina o preço", variant: "destructive" }); return;
    }
    try {
      const sku = `AUTO-${item.resourceName}-${item.mtaCommand}-${Date.now()}`;
      const res = await fetch("/api/admin/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: item.editName, description: item.suggestedDesc, sku, price: item.editPrice, currency: "BRL", category: item.category, mtaCommand: item.mtaCommand, mtaParams: item.mtaParams, isActive: false }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      toast({ title: "Criado!", description: `"${item.editName}" adicionado (inativo).` });
      qc.invalidateQueries({ queryKey: ["/api/admin/products"] });
      setItems(prev => prev.filter(p => p !== item));
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
  }

  const catColor = (c: string) => ({
    vip: "text-amber-500 bg-amber-500/10 border-amber-500/20",
    vehicle: "text-blue-500 bg-blue-500/10 border-blue-500/20",
    coins: "text-emerald-500 bg-emerald-500/10 border-emerald-500/20",
  }[c] || "text-purple-500 bg-purple-500/10 border-purple-500/20");

  const stateColor = (s: string) => ({
    running: "text-green-500 bg-green-500/10",
    loaded: "text-blue-500 bg-blue-500/10",
    failed: "text-red-500 bg-red-500/10",
  }[s] || "text-yellow-500 bg-yellow-500/10");

  const stateLabel = (s: string) => ({ running: "Rodando", loaded: "Parado", failed: "Falhou", starting: "Iniciando" }[s] || s);

  const filtered = (scan?.resources || []).filter(r =>
    r.name.toLowerCase().includes(search.toLowerCase()) || (r.description||"").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2">
                <ScanLine className="h-5 w-5 text-primary" />
                Scanner Inteligente de Mods
              </CardTitle>
              <CardDescription>
                Detecta VIPs, veículos, kits e sistemas automaticamente. Você só define o preço.
              </CardDescription>
            </div>
            <div className="flex gap-2 flex-wrap">
              {scan && (scan.detectedItems || 0) > 0 && (
                <Button variant="outline" onClick={autoSync} disabled={syncing} className="gap-2">
                  {syncing ? <><Loader2 className="h-4 w-4 animate-spin" />Criando...</> : <><Plug className="h-4 w-4" />Criar Todos</>}
                </Button>
              )}
              <Button onClick={runScan} disabled={scanning} className="gap-2">
                {scanning ? <><Loader2 className="h-4 w-4 animate-spin" />Escaneando...</> : <><ScanLine className="h-4 w-4" />Escanear</>}
              </Button>
            </div>
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
            {(["detected","all"] as const).map(tab => (
              <button key={tab} onClick={() => setView(tab)}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${view===tab?"border-primary text-primary":"border-transparent text-muted-foreground"}`}>
                {tab === "detected" ? `Detectados (${items.length})` : `Todos os Resources (${scan.total})`}
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
                    <p className="text-sm text-muted-foreground">Defina o preço de cada item e clique em <strong>Criar</strong>. O produto fica inativo até você ativar na aba Produtos.</p>
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
                            <Input value={item.editName} onChange={e => setItems(prev => prev.map((p,i) => i===idx?{...p,editName:e.target.value}:p))} className="h-9" />
                          </div>
                          <div className="space-y-1">
                            <label className="text-xs text-muted-foreground">Preço (R$) *</label>
                            <Input type="number" min="0" step="0.01" placeholder="29.90" value={item.editPrice} onChange={e => setItems(prev => prev.map((p,i) => i===idx?{...p,editPrice:e.target.value}:p))} className="h-9" />
                          </div>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/40 rounded-lg px-3 py-2 font-mono">
                          <span className="text-primary">{item.mtaCommand}</span>
                          <span>{JSON.stringify(item.mtaParams)}</span>
                        </div>
                        <Button size="sm" className="w-full" onClick={() => createItem(item)} disabled={!item.editPrice||parseFloat(item.editPrice)<=0}>
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
                      <Layers className={`h-4 w-4 shrink-0 ${r.state==="running"?"text-green-500":"text-muted-foreground"}`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-sm">{r.name}</span>
                          <Badge variant="outline" className={`text-xs ${stateColor(r.state)}`}>{stateLabel(r.state)}</Badge>
                          {r.classified && r.classified !== "other" && <Badge variant="secondary" className="text-xs capitalize">{r.classified}</Badge>}
                          {r.sellable && r.sellable.length > 0 && <Badge className="text-xs bg-amber-500/10 text-amber-500 border-amber-500/20">{r.sellable.length} item(s)</Badge>}
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
            <p className="text-sm text-muted-foreground mb-4">Clique em "Escanear" para detectar VIPs, veículos, kits e outros mods vendáveis.</p>
            <Button onClick={runScan}><ScanLine className="h-4 w-4 mr-2" />Escanear agora</Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
