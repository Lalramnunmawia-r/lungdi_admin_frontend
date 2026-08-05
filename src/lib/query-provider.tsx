"use client";

import { useState } from "react";
import {
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import { ApiError } from "./api-client";

function shouldRetry(failureCount: number, error: unknown): boolean {
  // 401/403/404/409 are never transient — retrying them just delays showing
  // the real error. Everything else (network blips, a 5xx) gets a couple of
  // tries.
  if (error instanceof ApiError && error.status < 500) return false;
  return failureCount < 2;
}

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            retry: shouldRetry,
            staleTime: 15_000,
            refetchOnWindowFocus: false,
          },
          mutations: {
            retry: false,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}
