import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { getAuthHeaders } from "./auth";

export async function apiRequest(method: string, url: string, data?: unknown): Promise<Response> {
  return fetch(url, {
    method,
    headers: { ...(data ? { "Content-Type": "application/json" } : {}), ...getAuthHeaders() },
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });
}

const defaultQueryFn: QueryFunction = async ({ queryKey }) => {
  const res = await fetch(queryKey[0] as string, {
    credentials: "include",
    headers: getAuthHeaders(),
  });
  if (res.status === 401) return null;
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json();
};

export const getQueryFn = (_opts: { on401: "returnNull" | "throw" }) => defaultQueryFn;

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: defaultQueryFn,
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000,
      retry: false,
    },
    mutations: { retry: false },
  },
});
