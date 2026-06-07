import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown,
): Promise<Response> {
  const res = await fetch(url, {
    method,
    headers: data ? { "Content-Type": "application/json" } : {},
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });
  return res; // não lança aqui — o chamador decide
}

type UnauthorizedBehavior = "returnNull" | "throw";

export const getQueryFn = <T>(options: {
  on401: UnauthorizedBehavior;
}): QueryFunction<T> => {
  const { on401 } = options;

  return async ({ queryKey }) => {
    const res = await fetch(queryKey[0] as string, { credentials: "include" });

    if (res.status === 401) {
      if (on401 === "returnNull") return null as T;
      throw new Error("401: Não autenticado");
    }

    await throwIfResNotOk(res);
    return res.json() as Promise<T>;
  };
};

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "returnNull" }),
      refetchInterval: false,
      refetchOnWindowFocus: false, // evita 401 ao voltar o foco antes da sessão ser validada
      staleTime: 5 * 60 * 1000,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
