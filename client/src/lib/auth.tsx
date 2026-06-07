import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import type { User } from "@shared/schema";

const TOKEN_KEY = "mta_token";

export function saveToken(t: string) { try { localStorage.setItem(TOKEN_KEY, t); } catch {} }
export function getToken(): string | null { try { return localStorage.getItem(TOKEN_KEY); } catch { return null; } }
export function clearToken() { try { localStorage.removeItem(TOKEN_KEY); } catch {} }

export function getAuthHeaders(): Record<string, string> {
  const t = getToken();
  return t ? { Authorization: `Bearer ${t}` } : {};
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
  register: (data: { username: string; email: string; password: string; mtaSerial?: string; mtaAccount?: string }) => Promise<void>;
  logout: () => Promise<void>;
  refetch: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchUser = async () => {
    const token = getToken();
    if (!token) { setIsLoading(false); return; }
    try {
      const res = await fetch("/api/auth/me", {
        headers: { Authorization: `Bearer ${token}` },
        credentials: "include",
      });
      if (res.ok) { const d = await res.json(); setUser(d.user); }
      else { clearToken(); setUser(null); }
    } catch { setUser(null); }
    finally { setIsLoading(false); }
  };

  useEffect(() => { fetchUser(); }, []);

  const login = async (username: string, password: string) => {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
      credentials: "include",
    });
    if (!res.ok) { const e = await res.json(); throw new Error(e.message || "Login falhou"); }
    const d = await res.json();
    if (d.token) saveToken(d.token);
    setUser(d.user);
  };

  const register = async (data: any) => {
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
      credentials: "include",
    });
    if (!res.ok) { const e = await res.json(); throw new Error(e.message || "Registro falhou"); }
    const d = await res.json();
    if (d.token) saveToken(d.token);
    setUser(d.user);
  };

  const logout = async () => {
    clearToken();
    setUser(null);
    await fetch("/api/auth/logout", { method: "POST", headers: getAuthHeaders(), credentials: "include" });
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, register, logout, refetch: fetchUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
