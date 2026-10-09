import { useCallback, useEffect, useState } from 'react';

export type ThemePreference = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'financas_tema';

function getSystemPrefersDark(): boolean {
  return typeof window !== 'undefined' && !!window.matchMedia
    ? window.matchMedia('(prefers-color-scheme: dark)').matches
    : false;
}

function applyThemeClass(pref: ThemePreference) {
  const isDark = pref === 'dark' || (pref === 'system' && getSystemPrefersDark());
  document.documentElement.classList.toggle('dark', isDark);
}

/**
 * Preferência de tema (claro/escuro/sistema), persistida em localStorage e
 * aplicada como classe `.dark` na raiz do documento — é essa classe que o
 * Tailwind usa pras variantes `dark:` (ver @custom-variant em index.css).
 */
export function useThemePreference(): [ThemePreference, (pref: ThemePreference) => void] {
  const [preference, setPreference] = useState<ThemePreference>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === 'light' || saved === 'dark' || saved === 'system') return saved;
    } catch {
      // ignora
    }
    return 'system';
  });

  useEffect(() => {
    applyThemeClass(preference);
    try {
      localStorage.setItem(STORAGE_KEY, preference);
    } catch {
      // ignora
    }
  }, [preference]);

  // Reage a mudanças na preferência do SISTEMA enquanto o modo escolhido for "system"
  useEffect(() => {
    if (preference !== 'system' || typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => applyThemeClass('system');
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [preference]);

  const setTheme = useCallback((pref: ThemePreference) => {
    setPreference(pref);
  }, []);

  return [preference, setTheme];
}
