import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    // Try to parse JSON error to show friendly message
    let message = text;
    try {
      const json = JSON.parse(text);
      if (json?.message) message = json.message;
    } catch {}
  toast({ title: `Ошибка ${res.status}`, description: message, variant: "destructive" });
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  url: string,
  method: string,
  data?: unknown | undefined,
): Promise<Response> {
  const res = await fetch(url, {
    method,
    headers: data ? { "Content-Type": "application/json" } : {},
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  if (!res.ok) {
    // Collect extra details for the toast
    const requestId = res.headers.get('x-request-id') || res.headers.get('x-correlation-id') || undefined;
    const details = [`${method.toUpperCase()} ${url}`];
    if (requestId) details.push(`id: ${requestId}`);
  toast({ title: `Ошибка ${res.status}`, description: details.join(' • '), variant: 'destructive' });
  }

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
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});

// Global error toasts for queries/mutations
queryClient.getQueryCache().subscribe((event) => {
  // Only show toasts for errors
  if ((event as any)?.type === 'queryUpdated') {
    const query: any = (event as any).query;
    const state = query?.state;
    if (state?.status === 'error' && state?.error) {
      const msg = state.error?.message || 'Не удалось загрузить данные';
  toast({ title: 'Ошибка запроса', description: String(msg), variant: 'destructive' });
    }
  }
});

queryClient.getMutationCache().subscribe((event) => {
  if ((event as any)?.type === 'mutationAdded') {
    const m: any = (event as any).mutation;
    m.addObserver({
      onError: (error: any) => {
        const msg = error?.message || 'Не удалось выполнить операцию';
  toast({ title: 'Ошибка операции', description: String(msg), variant: 'destructive' });
      },
    } as any);
  }
});
