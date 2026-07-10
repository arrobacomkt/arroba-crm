import { type PropsWithChildren, useEffect, useMemo, useState } from 'react';

import { ThemeContext, type ThemeContextValue, type ThemeMode } from './theme-context';

const storageKey = 'arrobaco.theme';

function resolveInitialTheme(): ThemeMode {
  if (typeof window === 'undefined') return 'light';

  const savedTheme = window.localStorage.getItem(storageKey);
  if (savedTheme === 'light' || savedTheme === 'dark') {
    return savedTheme;
  }

  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function ThemeProvider({ children }: PropsWithChildren) {
  const [theme, setThemeState] = useState<ThemeMode>(() => resolveInitialTheme());

  useEffect(() => {
    window.localStorage.setItem(storageKey, theme);
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
  }, [theme]);

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme,
      setTheme: setThemeState,
    }),
    [theme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
