"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import {
  api,
  ApiError,
  getStoredRefreshToken,
  setAccessToken,
  setStoredRefreshToken,
  setUnauthorizedHandler,
} from "./api-client";
import type { AdminProfile, AdminSession } from "./types";

interface LoginResult {
  mfaToken: string;
  totpEnrolled: boolean;
}

interface AuthContextValue {
  admin: AdminProfile | null;
  /** true while the initial silent-refresh-on-load attempt is still running. */
  isLoading: boolean;
  login: (email: string, password: string) => Promise<LoginResult>;
  verifyMfa: (mfaToken: string, code: string) => Promise<void>;
  enrollTotp: (mfaToken: string) => Promise<{ otpauthUrl: string; secret: string }>;
  confirmTotp: (mfaToken: string, code: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [admin, setAdmin] = useState<AdminProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  const handleSession = useCallback((session: AdminSession) => {
    setAccessToken(session.accessToken);
    setStoredRefreshToken(session.refreshToken);
    setAdmin(session.admin);
  }, []);

  const clearSession = useCallback(() => {
    setAccessToken(null);
    setStoredRefreshToken(null);
    setAdmin(null);
  }, []);

  // On load, a stored refresh token is the only evidence a session might
  // still be valid — api-client's own 401-triggered refresh doesn't run
  // until something makes a request, so this fires ONE deliberately to
  // establish admin state before the first protected page renders.
  useEffect(() => {
    let cancelled = false;
    async function restore() {
      const refreshToken = getStoredRefreshToken();
      if (!refreshToken) {
        setIsLoading(false);
        return;
      }
      try {
        const res = await api.post<{ accessToken: string }>(
          "/admin/auth/refresh",
          { refreshToken },
        );
        if (cancelled) return;
        setAccessToken(res.accessToken);
        const profile = await api.get<AdminProfile>("/admin/auth/me");
        if (cancelled) return;
        setAdmin(profile);
      } catch {
        if (!cancelled) clearSession();
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    void restore();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      clearSession();
      router.push("/login");
    });
    return () => setUnauthorizedHandler(null);
  }, [clearSession, router]);

  const login = useCallback(async (email: string, password: string) => {
    return api.post<LoginResult>("/admin/auth/login", { email, password });
  }, []);

  const verifyMfa = useCallback(
    async (mfaToken: string, code: string) => {
      const session = await api.post<AdminSession>("/admin/auth/mfa", {
        mfaToken,
        code,
      });
      handleSession(session);
    },
    [handleSession],
  );

  const enrollTotp = useCallback(async (mfaToken: string) => {
    return api.post<{ otpauthUrl: string; secret: string }>(
      "/admin/auth/totp/enroll",
      { mfaToken },
    );
  }, []);

  const confirmTotp = useCallback(
    async (mfaToken: string, code: string) => {
      const session = await api.post<AdminSession>("/admin/auth/totp/confirm", {
        mfaToken,
        code,
      });
      handleSession(session);
    },
    [handleSession],
  );

  const logout = useCallback(async () => {
    try {
      await api.post("/admin/auth/logout");
    } catch (error) {
      // Already-invalid token, network hiccup — either way the local session
      // still gets cleared below, so a failed logout call never traps the
      // admin on the dashboard.
      if (!(error instanceof ApiError)) throw error;
    } finally {
      clearSession();
      router.push("/login");
    }
  }, [clearSession, router]);

  return (
    <AuthContext.Provider
      value={{
        admin,
        isLoading,
        login,
        verifyMfa,
        enrollTotp,
        confirmTotp,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
