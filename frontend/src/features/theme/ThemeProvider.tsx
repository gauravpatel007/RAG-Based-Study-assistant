import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import { api } from '@/lib/api';
import { type ThemeMode, type AccentColor, DEFAULT_THEME, DEFAULT_ACCENT } from './palette';

interface ThemeContextType {
  theme: ThemeMode;
  accent: AccentColor;
  previewTheme: ThemeMode | null;
  previewAccent: AccentColor | null;
  version: number;
  setPreview: (theme: ThemeMode, accent: AccentColor) => void;
  clearPreview: () => void;
  save: (theme: ThemeMode, accent: AccentColor) => Promise<void>;
  resetToDefault: () => void;
}

const CACHE_KEY = 'sa_theme_cache';

interface CachedTheme {
  userId: string;
  theme: ThemeMode;
  accent: AccentColor;
}

function readCache(): CachedTheme | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeCache(data: CachedTheme) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(data));
  } catch { /* quota exceeded or private mode */ }
}

function clearCache() {
  try {
    localStorage.removeItem(CACHE_KEY);
  } catch { /* ignore */ }
}

function applyToDOM(theme: ThemeMode, accent: AccentColor) {
  document.documentElement.setAttribute('data-theme', theme);
  document.documentElement.setAttribute('data-accent', accent);
}

const ThemeContext = createContext<ThemeContextType | null>(null);

export function ThemeProvider({ children, userId }: { children: ReactNode; userId?: string }) {
  // Initialize from cache or defaults
  const cached = readCache();
  const initialTheme = (cached && cached.userId === userId) ? cached.theme : DEFAULT_THEME;
  const initialAccent = (cached && cached.userId === userId) ? cached.accent : DEFAULT_ACCENT;

  const [theme, setTheme] = useState<ThemeMode>(initialTheme);
  const [accent, setAccent] = useState<AccentColor>(initialAccent);
  const [version, setVersion] = useState(0);
  const [previewTheme, setPreviewTheme] = useState<ThemeMode | null>(null);
  const [previewAccent, setPreviewAccent] = useState<AccentColor | null>(null);

  // Apply theme to DOM immediately on mount and on change
  useEffect(() => {
    applyToDOM(previewTheme ?? theme, previewAccent ?? accent);
  }, [theme, accent, previewTheme, previewAccent]);

  // Fetch confirmed preferences from server on mount
  useEffect(() => {
    if (!userId) return;
    api.getPreferences().then(prefs => {
      const t = prefs.theme as ThemeMode;
      const a = prefs.accent_color as AccentColor;
      setTheme(t);
      setAccent(a);
      setVersion(prefs.version);
      writeCache({ userId, theme: t, accent: a });
    }).catch(() => {
      // Use cached or defaults
    });
  }, [userId]);

  // Cross-tab synchronization via storage event
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === CACHE_KEY && e.newValue) {
        try {
          const data: CachedTheme = JSON.parse(e.newValue);
          if (data.userId === userId) {
            setTheme(data.theme);
            setAccent(data.accent);
          }
        } catch { /* ignore */ }
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, [userId]);

  // Refetch on window focus for cross-device changes
  useEffect(() => {
    const handleFocus = () => {
      if (!userId) return;
      api.getPreferences().then(prefs => {
        const t = prefs.theme as ThemeMode;
        const a = prefs.accent_color as AccentColor;
        setTheme(t);
        setAccent(a);
        setVersion(prefs.version);
        writeCache({ userId, theme: t, accent: a });
      }).catch(() => {});
    };
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [userId]);

  const setPreview = useCallback((t: ThemeMode, a: AccentColor) => {
    setPreviewTheme(t);
    setPreviewAccent(a);
  }, []);

  const clearPreview = useCallback(() => {
    setPreviewTheme(null);
    setPreviewAccent(null);
  }, []);

  const save = useCallback(async (t: ThemeMode, a: AccentColor) => {
    const result = await api.updatePreferences({ theme: t, accent_color: a, version });
    setTheme(t);
    setAccent(a);
    setVersion(result.version);
    setPreviewTheme(null);
    setPreviewAccent(null);
    if (userId) writeCache({ userId, theme: t, accent: a });
  }, [version, userId]);

  const resetToDefault = useCallback(() => {
    setPreviewTheme(DEFAULT_THEME);
    setPreviewAccent(DEFAULT_ACCENT);
  }, []);

  return (
    <ThemeContext.Provider value={{
      theme, accent,
      previewTheme, previewAccent,
      version,
      setPreview, clearPreview, save, resetToDefault,
    }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}

/** Call on logout to reset theme to default and clear cache */
export function clearThemeOnLogout() {
  clearCache();
  applyToDOM(DEFAULT_THEME, DEFAULT_ACCENT);
}
