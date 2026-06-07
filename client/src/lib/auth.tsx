import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import type { User } from "@shared/schema";

const TOKEN_KEY = "mta_session_token";

// Helpers para guardar/ler o token no localStorage
function saveToken(token: string) {
  try { localStorage.setItem(TOKEN_KEY, token); } catch { /* privado */ }
}
function loadToken(): string | null {
  try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
}
function clearToken() {
  try { localStorage.removeItem(TOKEN_KEY); } catch { /* ignora */ }
}

// Header de autenticação — enviado em toda requisição como fallback ao cookie
export function getAuthHeaders(): Record<string, string> {
  const token = loadToken();
  return token ? { "X-Session-Token": token } : {};
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
  register: (data: {
    username: string; email: string; password: string;
    mtaSerial?: string; mtaAccount?: string;
  }) => Promise<void>;
  logout: () => Promise<void>;
  refetch: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchUser = async () => {
    try {
      const res = await fetch("/api/auth/me", {
        credentials: "include",
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
      } else {
        setUser(null);
        clearToken();
      }
    } catch {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUser();
  }, []);

  const login = async (username: string, password: string) => {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
      credentials: "include",
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.message || "Login falhou");
    }
    const data = await res.json();
    // Guarda o token para usar como fallback quando o cookie falha
    if (data.sessionToken) saveToken(data.sessionToken);
    setUser(data.user);
  };

  const register = async (data: {
    username: string; email: string; password: string;
    mtaSerial?: string; mtaAccount?: string;
  }) => {
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
      credentials: "include",
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.message || "Registro falhou");
    }
    const result = await res.json();
    if (result.sessionToken) saveToken(result.sessionToken);
    setUser(result.user);
  };

  const logout = async () => {
    clearToken();
    await fetch("/api/auth/logout", {
      method: "POST",
      credentials: "include",
      headers: getAuthHeaders(),
    });
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, register, logout, refetch: fetchUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within an AuthProvider");
  return context;
}
