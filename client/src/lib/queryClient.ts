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
  data?: unknown | undefined,
): Promise<Response> {
  const res = await fetch(url, {
    method,
    headers: data ? { "Content-Type": "application/json" } : {},
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const res = await fetch(queryKey.join("/") as string, {
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
<<<<<<< HEAD
      refetchOnWindowFocus: true,
      staleTime: 5 * 60 * 1000, // 5 minutos
=======
<<<<<<< HEAD
      refetchOnWindowFocus: true,
      staleTime: 5 * 60 * 1000, // 5 minutos
=======
      refetchOnWindowFocus: false,
      staleTime: Infinity,
>>>>>>> e7138a83cf3280dc79544e2aebc0c60b1f7376eb
>>>>>>> c1ee9d5dd779ecff30130bc452ea604430bbefda
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
