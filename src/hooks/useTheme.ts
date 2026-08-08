import { useCallback, useEffect, useState } from 'react';

const KEY = 'vinyl:theme';
const DARK = '(prefers-color-scheme: dark)';

export type Theme = 'dark' | 'light';

const apply = (theme: Theme) => {
  document.documentElement.dataset.theme = theme;
};

/**
 * El script inline de Base.astro ya resolvió el tema antes del primer pintado;
 * acá sólo lo sincronizamos. Sin elección guardada seguimos al sistema en vivo:
 * si el usuario cambia el suyo con la pestaña abierta, la página lo acompaña.
 */
export function useTheme(): [Theme, () => void] {
  const [theme, setTheme] = useState<Theme>('dark');

  useEffect(() => {
    setTheme(document.documentElement.dataset.theme === 'light' ? 'light' : 'dark');

    const media = window.matchMedia(DARK);
    const onSystem = () => {
      let saved: string | null = null;
      try {
        saved = localStorage.getItem(KEY);
      } catch {
        /* sin storage no hay elección guardada que respetar */
      }
      if (saved) return;
      const next: Theme = media.matches ? 'dark' : 'light';
      apply(next);
      setTheme(next);
    };

    media.addEventListener('change', onSystem);
    return () => media.removeEventListener('change', onSystem);
  }, []);

  const toggle = useCallback(() => {
    setTheme((prev) => {
      const next: Theme = prev === 'dark' ? 'light' : 'dark';
      apply(next);
      try {
        localStorage.setItem(KEY, next);
      } catch {
        /* modo privado: el tema dura lo que dure la pestaña */
      }
      return next;
    });
  }, []);

  return [theme, toggle];
}
