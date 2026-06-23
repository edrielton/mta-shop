import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { Loader2, Gamepad2, Shield, Zap } from "lucide-react";
import { Animated, StaggerContainer, StaggerItem } from "@/components/animated";

const loginSchema = z.object({
  username: z.string().min(3, "Usuário deve ter pelo menos 3 caracteres"),
  password: z.string().min(6, "Senha deve ter pelo menos 6 caracteres"),
});

const registerSchema = z.object({
  username: z.string().min(3, "Usuário deve ter pelo menos 3 caracteres"),
  email: z.string().email("Email inválido"),
  password: z.string().min(6, "Senha deve ter pelo menos 6 caracteres"),
  confirmPassword: z.string(),
  mtaSerial: z.string().optional(),
  mtaAccount: z.string().optional(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "As senhas não coincidem",
  path: ["confirmPassword"],
});

type LoginForm = z.infer<typeof loginSchema>;
type RegisterForm = z.infer<typeof registerSchema>;

export default function AuthPage() {
  const [, setLocation] = useLocation();
  const { user, isLoading: authLoading, login, register } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const loginForm = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { username: "", password: "" },
  });

  const registerForm = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      username: "", email: "", password: "",
      confirmPassword: "", mtaSerial: "", mtaAccount: "",
    },
  });

  useEffect(() => {
    if (!authLoading && user) {
      setLocation("/dashboard");
    }
  }, [authLoading, user, setLocation]);

  const onLogin = async (data: LoginForm) => {
    setIsLoading(true);
    try {
      await login(data.username, data.password);
      toast({ title: "Login realizado!", description: "Bem-vindo de volta!" });
      setLocation("/dashboard");
    } catch (error) {
      toast({
        title: "Erro no login",
        description: error instanceof Error ? error.message : "Usuário ou senha incorretos",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const onRegister = async (data: RegisterForm) => {
    setIsLoading(true);
    try {
      await register({
        username: data.username,
        email: data.email,
        password: data.password,
        mtaSerial: data.mtaSerial || undefined,
        mtaAccount: data.mtaAccount || undefined,
      });
      toast({ title: "Conta criada!", description: "Sua conta foi criada com sucesso." });
      setLocation("/dashboard");
    } catch (error) {
      toast({
        title: "Erro no cadastro",
        description: error instanceof Error ? error.message : "Falha ao criar conta",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex">
      {/* Formulário */}
      <div className="flex-1 flex items-center justify-center p-8">
        <Animated variant="fadeUp" className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 text-primary mb-4">
              <Gamepad2 className="h-8 w-8" />
            </div>
            <h1 className="font-display text-3xl font-bold">MTA Server Store</h1>
            <p className="text-muted-foreground mt-2">Acesse sua conta ou crie uma nova</p>
          </div>

          <Tabs defaultValue="login" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-6">
              <TabsTrigger value="login" data-testid="tab-login">Entrar</TabsTrigger>
              <TabsTrigger value="register" data-testid="tab-register">Criar Conta</TabsTrigger>
            </TabsList>

            <TabsContent value="login">
              <Card>
                <CardHeader>
                  <CardTitle>Entrar na Conta</CardTitle>
                  <CardDescription>Digite suas credenciais para acessar</CardDescription>
                </CardHeader>
                <CardContent>
                  <Form {...loginForm}>
                    <form onSubmit={loginForm.handleSubmit(onLogin)} className="space-y-4">
                      <FormField control={loginForm.control} name="username" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Usuário</FormLabel>
                          <FormControl>
                            <Input placeholder="seu_usuario" {...field} data-testid="input-login-username" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={loginForm.control} name="password" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Senha</FormLabel>
                          <FormControl>
                            <Input type="password" placeholder="••••••••" {...field} data-testid="input-login-password" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <Button type="submit" className="w-full" disabled={isLoading} data-testid="button-login-submit">
                        {isLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Entrando...</> : "Entrar"}
                      </Button>
                    </form>
                  </Form>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="register">
              <Card>
                <CardHeader>
                  <CardTitle>Criar Conta</CardTitle>
                  <CardDescription>Preencha os dados para criar sua conta</CardDescription>
                </CardHeader>
                <CardContent>
                  <Form {...registerForm}>
                    <form onSubmit={registerForm.handleSubmit(onRegister)} className="space-y-4">
                      <FormField control={registerForm.control} name="username" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Usuário</FormLabel>
                          <FormControl>
                            <Input placeholder="seu_usuario" {...field} data-testid="input-register-username" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={registerForm.control} name="email" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email</FormLabel>
                          <FormControl>
                            <Input type="email" placeholder="seu@email.com" {...field} data-testid="input-register-email" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <div className="grid grid-cols-2 gap-4">
                        <FormField control={registerForm.control} name="password" render={({ field }) => (
                          <FormItem>
                            <FormLabel>Senha</FormLabel>
                            <FormControl>
                              <Input type="password" placeholder="••••••" {...field} data-testid="input-register-password" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )} />
                        <FormField control={registerForm.control} name="confirmPassword" render={({ field }) => (
                          <FormItem>
                            <FormLabel>Confirmar</FormLabel>
                            <FormControl>
                              <Input type="password" placeholder="••••••" {...field} data-testid="input-register-confirm" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )} />
                      </div>

                      <div className="pt-4 border-t">
                        <p className="text-sm text-muted-foreground mb-4">Vincule sua conta MTA (opcional)</p>
                        <div className="grid grid-cols-2 gap-4">
                          <FormField control={registerForm.control} name="mtaSerial" render={({ field }) => (
                            <FormItem>
                              <FormLabel>Serial MTA</FormLabel>
                              <FormControl>
                                <Input placeholder="Seu serial" {...field} data-testid="input-register-serial" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )} />
                          <FormField control={registerForm.control} name="mtaAccount" render={({ field }) => (
                            <FormItem>
                              <FormLabel>Conta MTA</FormLabel>
                              <FormControl>
                                <Input placeholder="Nome no jogo" {...field} data-testid="input-register-account" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )} />
                        </div>
                      </div>

                      <Button type="submit" className="w-full" disabled={isLoading} data-testid="button-register-submit">
                        {isLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Criando...</> : "Criar Conta"}
                      </Button>
                    </form>
                  </Form>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </Animated>
      </div>

      {/* Lado direito — info */}
      <div className="hidden lg:flex flex-1 bg-primary/5 items-center justify-center p-8">
        <StaggerContainer className="max-w-md" stagger={0.15}>
          <StaggerItem>
            <h2 className="font-display text-3xl font-bold mb-6">Por que criar uma conta?</h2>
          </StaggerItem>
          {[
            { icon: <Zap className="h-5 w-5" />, title: "Ativação Instantânea", desc: "Seus itens são ativados automaticamente assim que o pagamento é confirmado" },
            { icon: <Shield className="h-5 w-5" />, title: "Histórico Completo", desc: "Acompanhe todas suas compras e status de ativação em um só lugar" },
            { icon: <Gamepad2 className="h-5 w-5" />, title: "Vinculação MTA", desc: "Vincule seu serial ou conta MTA para ativação automática no servidor" },
          ].map((item, i) => (
            <StaggerItem key={i}>
              <div className="flex gap-4 mb-6">
                <div className="shrink-0 w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                  {item.icon}
                </div>
                <div>
                  <h3 className="font-semibold mb-1">{item.title}</h3>
                  <p className="text-muted-foreground text-sm">{item.desc}</p>
                </div>
              </div>
            </StaggerItem>
          ))}
        </StaggerContainer>
      </div>
    </div>
  );
}
