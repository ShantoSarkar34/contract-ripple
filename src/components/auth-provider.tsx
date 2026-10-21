"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { AuthSessionResponse, AuthUserDto } from "@contract-ripple/shared";
import {
  ApiRequestError,
  api,
  setCsrfToken,
  setUnauthorizedHandler,
} from "@/lib/api";

export type AuthStatus = "checking" | "authenticated" | "anonymous" | "error";

type AuthContextValue = {
  status: AuthStatus;
  user: AuthUserDto | null;
  error: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function sessionError(error: unknown): string {
  if (error instanceof ApiRequestError) {
    return error.message;
  }
  return error instanceof Error ? error.message : "Could not load your session.";
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("checking");
  const [user, setUser] = useState<AuthUserDto | null>(null);
  const [error, setError] = useState<string | null>(null);

  const applySession = useCallback((session: AuthSessionResponse) => {
    setCsrfToken(session.csrfToken);
    setUser(session.user);
    setError(null);
    setStatus("authenticated");
  }, []);

  const clearSession = useCallback(() => {
    setCsrfToken(null);
    setUser(null);
    setStatus("anonymous");
  }, []);

  const handleSessionFailure = useCallback(
    (sessionFailure: unknown) => {
      if (sessionFailure instanceof ApiRequestError && sessionFailure.status === 401) {
        clearSession();
        return;
      }
      setError(sessionError(sessionFailure));
      setStatus("error");
    },
    [clearSession],
  );

  const loadSession = useCallback(
    () => api.getSession().then(applySession).catch(handleSessionFailure),
    [applySession, handleSessionFailure],
  );

  const refresh = useCallback(async () => {
    setStatus("checking");
    await loadSession();
  }, [loadSession]);

  useEffect(() => {
    setUnauthorizedHandler(clearSession);
    return () => setUnauthorizedHandler(null);
  }, [clearSession]);

  useEffect(() => {
    let active = true;
    api
      .getSession()
      .then((session) => {
        if (active) {
          applySession(session);
        }
      })
      .catch((sessionFailure: unknown) => {
        if (active) {
          handleSessionFailure(sessionFailure);
        }
      });
    return () => {
      active = false;
    };
  }, [applySession, handleSessionFailure]);

  const signIn = useCallback(
    async (email: string, password: string) => {
      applySession(await api.login({ email, password }));
    },
    [applySession],
  );

  const signUp = useCallback(
    async (email: string, password: string) => {
      applySession(await api.register({ email, password }));
    },
    [applySession],
  );

  const signOut = useCallback(async () => {
    try {
      await api.logout();
    } catch {
      // The local session is cleared even if the API call fails.
    }
    clearSession();
  }, [clearSession]);

  const value = useMemo<AuthContextValue>(
    () => ({ status, user, error, signIn, signUp, signOut, refresh }),
    [status, user, error, signIn, signUp, signOut, refresh],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error("useAuth must be used inside an AuthProvider.");
  }
  return value;
}
