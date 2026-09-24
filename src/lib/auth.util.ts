export const TOKEN_STORAGE_KEY = "authToken";
const USER_KEY = "clause-user";

export interface StoredUser {
  id: string;
  email: string;
  name?: string;
  createdAt?: string;
}

export const getAuthToken = (): string | null => {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_STORAGE_KEY);
};

export const setAuthToken = (token: string) => {
  if (typeof window === "undefined") return;
  localStorage.setItem(TOKEN_STORAGE_KEY, token);
};

export const clearAuth = () => {
  if (typeof window === "undefined") return;
  localStorage.removeItem(TOKEN_STORAGE_KEY);
  localStorage.removeItem(USER_KEY);
};

export const readStoredUser = (): StoredUser | null => {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as StoredUser) : null;
  } catch {
    return null;
  }
};

export const writeStoredUser = (user: StoredUser) => {
  if (typeof window === "undefined") return;
  localStorage.setItem(USER_KEY, JSON.stringify(user));
};

export const initAuthListeners = (
  onUnauthorized: () => void,
  onAuthRestored: () => void,
) => {
  if (typeof window === "undefined") return () => {};

  const handleStorageChange = (e: StorageEvent) => {
    if (e.key === TOKEN_STORAGE_KEY) {
      if (!e.newValue) onUnauthorized();
      else onAuthRestored();
    }
  };

  window.addEventListener("auth:unauthorized", onUnauthorized);
  window.addEventListener("storage", handleStorageChange);

  return () => {
    window.removeEventListener("auth:unauthorized", onUnauthorized);
    window.removeEventListener("storage", handleStorageChange);
  };
};
