import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { useNavigate } from "react-router-dom";

// ── Types ──────────────────────────────────────────────────────────────────────

export interface AuthUser {
  id: number;
  email: string;
  name: string;
}

interface AuthContextType {
  user: AuthUser | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (name: string, email: string, password: string) => Promise<void>;
  logout: () => void;
}

// ── Storage keys ───────────────────────────────────────────────────────────────

const TOKEN_KEY = "duewell_token";
const USER_KEY = "duewell_user";

function readStorage(): { token: string | null; user: AuthUser | null } {
  try {
    const token = localStorage.getItem(TOKEN_KEY);
    const raw = localStorage.getItem(USER_KEY);
    const user: AuthUser | null = raw ? JSON.parse(raw) : null;
    return { token, user };
  } catch {
    return { token: null, user: null };
  }
}

function writeStorage(token: string, user: AuthUser) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

function clearStorage() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

// ── Context ────────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";

/**
 * Makes an authenticated fetch with the current token.
 * Does NOT call logout on 401 (that logic lives in the shared apiRequest util).
 */
async function authedFetch(
  path: string,
  token: string | null,
  options?: RequestInit
): Promise<Response> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options?.headers as Record<string, string>),
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  return fetch(`${API_BASE}${path}`, { ...options, headers });
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();

  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);


  const logout = useCallback(() => {
    clearStorage();
    setToken(null);
    setUser(null);
    navigate("/auth", { replace: true });
  }, [navigate]);

  // Keep the module-level callLogout fn up to date so apiRequest can call it
  // without importing react-router navigate.
  useEffect(() => {
    _setLogoutFn(logout);
  }, [logout]);


  // ── Validate session on mount ────────────────────────────────────────────
  useEffect(() => {
    const { token: storedToken, user: storedUser } = readStorage();

    if (!storedToken) {
      setLoading(false);
      return;
    }

    // Optimistically set state from localStorage while we validate
    setToken(storedToken);
    setUser(storedUser);

    // Verify token is still valid by calling /auth/me
    authedFetch("/auth/me", storedToken)
      .then(async (res) => {
        if (res.ok) {
          const serverUser: AuthUser = await res.json();
          // Update user with fresh server data (name may have changed etc.)
          setUser(serverUser);
          localStorage.setItem(USER_KEY, JSON.stringify(serverUser));
        } else {
          // Token rejected — clear session silently
          clearStorage();
          setToken(null);
          setUser(null);
        }
      })
      .catch(() => {
        // Network error: keep optimistic state so the app works offline
        // but don't push the user to /auth on a transient failure.
      })
      .finally(() => {
        setLoading(false);
      });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── login ──────────────────────────────────────────────────────────────────
  const login = useCallback(async (email: string, password: string) => {
    const res = await authedFetch("/auth/login", null, {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || "Login failed");
    }

    const data = await res.json();
    const newToken: string = data.token || data.access_token;
    const newUser: AuthUser = data.user;

    writeStorage(newToken, newUser);
    setToken(newToken);
    setUser(newUser);
  }, []);

  // ── signup ─────────────────────────────────────────────────────────────────
  const signup = useCallback(
    async (name: string, email: string, password: string) => {
      const res = await authedFetch("/auth/signup", null, {
        method: "POST",
        body: JSON.stringify({ name, email, password }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || "Signup failed");
      }

      const data = await res.json();
      const newToken: string = data.token || data.access_token;
      const newUser: AuthUser = data.user;

      writeStorage(newToken, newUser);
      setToken(newToken);
      setUser(newUser);
    },
    []
  );

  // Remove stale ref block — replaced by useEffect above
  return (
    <AuthContext.Provider value={{ user, token, loading, login, signup, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}

/**
 * Expose a stable reference to the logout function that apiRequest can call
 * without importing useNavigate (which only works inside components).
 * Populated the first time AuthProvider mounts.
 */
let _logoutFn: (() => void) | null = null;
export function _setLogoutFn(fn: () => void) {
  _logoutFn = fn;
}
export function callLogout() {
  _logoutFn?.();
}
