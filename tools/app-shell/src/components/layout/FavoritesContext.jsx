import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useAuth } from '@/auth/AuthContext.jsx';

const FavoritesContext = createContext(null);

const STORAGE_PREFIX = 'sf_favorites_';

function storageKey(username) {
  return `${STORAGE_PREFIX}${username || 'anonymous'}`;
}

function readFavorites(username) {
  try {
    const raw = localStorage.getItem(storageKey(username));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((f) => f && typeof f.name === 'string')
      : [];
  } catch {
    return [];
  }
}

function writeFavorites(username, list) {
  try {
    localStorage.setItem(storageKey(username), JSON.stringify(list));
  } catch {
    /* ignore quota/availability errors */
  }
}

export function FavoritesProvider({ children }) {
  const { username } = useAuth();
  const [favorites, setFavorites] = useState(() => readFavorites(username));

  useEffect(() => {
    setFavorites(readFavorites(username));
  }, [username]);

  const addFavorite = useCallback(
    (name, label) => {
      if (!name) return;
      setFavorites((prev) => {
        if (prev.some((f) => f.name === name)) return prev;
        const next = [...prev, { name, label: label || name }];
        writeFavorites(username, next);
        return next;
      });
    },
    [username]
  );

  const removeFavorite = useCallback(
    (name) => {
      if (!name) return;
      setFavorites((prev) => {
        const next = prev.filter((f) => f.name !== name);
        writeFavorites(username, next);
        return next;
      });
    },
    [username]
  );

  const toggleFavorite = useCallback(
    (name, label) => {
      if (!name) return;
      setFavorites((prev) => {
        const exists = prev.some((f) => f.name === name);
        const next = exists
          ? prev.filter((f) => f.name !== name)
          : [...prev, { name, label: label || name }];
        writeFavorites(username, next);
        return next;
      });
    },
    [username]
  );

  const isFavorite = useCallback(
    (name) => favorites.some((f) => f.name === name),
    [favorites]
  );

  const value = useMemo(
    () => ({ favorites, addFavorite, removeFavorite, toggleFavorite, isFavorite }),
    [favorites, addFavorite, removeFavorite, toggleFavorite, isFavorite]
  );

  return (
    <FavoritesContext.Provider value={value}>
      {children}
    </FavoritesContext.Provider>
  );
}

export function useFavorites() {
  const ctx = useContext(FavoritesContext);
  if (!ctx) {
    return {
      favorites: [],
      addFavorite: () => {},
      removeFavorite: () => {},
      toggleFavorite: () => {},
      isFavorite: () => false,
    };
  }
  return ctx;
}
