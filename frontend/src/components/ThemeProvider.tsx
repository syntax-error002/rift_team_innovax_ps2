'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';

export type AppTheme = 'cyber' | 'ocean' | 'crimson' | 'matrix' | 'light';

export interface ThemeInfo {
  id: AppTheme;
  label: string;
  emoji: string;
  description: string;
}

export const THEMES: ThemeInfo[] = [
  { id: 'cyber', label: 'Cyber Dark', emoji: '🔷', description: 'Deep navy + neon cyan' },
  { id: 'ocean', label: 'Deep Ocean', emoji: '🌊', description: 'Midnight blue + teal' },
  { id: 'crimson', label: 'Crimson Ops', emoji: '🔴', description: 'Dark slate + red alert' },
  { id: 'matrix', label: 'Matrix', emoji: '🟩', description: 'Pure black + neon green' },
  { id: 'light', label: 'Light Mode', emoji: '☀️', description: 'Clean white forensics' },
];

/** Per-theme CSS variable maps — injected directly onto <html style="..."> so they always win. */
const THEME_VARS: Record<AppTheme, Record<string, string>> = {
  cyber: {
    '--background': '222 47% 6%',
    '--foreground': '210 40% 95%',
    '--card': '220 40% 9%',
    '--card-foreground': '210 40% 95%',
    '--popover': '220 40% 9%',
    '--popover-foreground': '210 40% 95%',
    '--primary': '192 100% 50%',
    '--primary-foreground': '222 47% 6%',
    '--secondary': '220 30% 14%',
    '--secondary-foreground': '210 40% 80%',
    '--muted': '220 30% 12%',
    '--muted-foreground': '215 20% 55%',
    '--accent': '270 80% 60%',
    '--accent-foreground': '210 40% 98%',
    '--destructive': '0 84% 60%',
    '--destructive-foreground': '210 40% 98%',
    '--border': '220 25% 16%',
    '--input': '220 25% 14%',
    '--ring': '192 100% 50%',
    '--radius': '0.6rem',
    '--theme-edge-glow': '#38bdf8',
    '--theme-mesh-a': 'hsla(222,80%,15%,0.7)',
    '--theme-mesh-b': 'hsla(270,70%,20%,0.5)',
    '--theme-mesh-c': 'hsla(192,100%,15%,0.4)',
  },
  ocean: {
    '--background': '225 50% 5%',
    '--foreground': '200 40% 92%',
    '--card': '224 45% 8%',
    '--card-foreground': '200 40% 92%',
    '--popover': '224 45% 8%',
    '--popover-foreground': '200 40% 92%',
    '--primary': '174 80% 48%',
    '--primary-foreground': '225 50% 5%',
    '--secondary': '224 35% 13%',
    '--secondary-foreground': '200 40% 78%',
    '--muted': '224 35% 11%',
    '--muted-foreground': '210 18% 52%',
    '--accent': '199 90% 55%',
    '--accent-foreground': '225 50% 5%',
    '--destructive': '15 80% 55%',
    '--destructive-foreground': '200 40% 95%',
    '--border': '224 28% 15%',
    '--input': '224 28% 12%',
    '--ring': '174 80% 48%',
    '--radius': '0.6rem',
    '--theme-edge-glow': '#2dd4bf',
    '--theme-mesh-a': 'hsla(225,80%,12%,0.8)',
    '--theme-mesh-b': 'hsla(200,70%,16%,0.6)',
    '--theme-mesh-c': 'hsla(174,60%,12%,0.4)',
  },
  crimson: {
    '--background': '10 20% 5%',
    '--foreground': '0 10% 90%',
    '--card': '8 22% 8%',
    '--card-foreground': '0 10% 90%',
    '--popover': '8 22% 8%',
    '--popover-foreground': '0 10% 90%',
    '--primary': '0 90% 58%',
    '--primary-foreground': '10 20% 5%',
    '--secondary': '8 18% 13%',
    '--secondary-foreground': '0 10% 75%',
    '--muted': '8 18% 11%',
    '--muted-foreground': '4 12% 50%',
    '--accent': '25 95% 58%',
    '--accent-foreground': '10 20% 5%',
    '--destructive': '0 84% 50%',
    '--destructive-foreground': '0 10% 95%',
    '--border': '8 20% 15%',
    '--input': '8 20% 12%',
    '--ring': '0 90% 58%',
    '--radius': '0.6rem',
    '--theme-edge-glow': '#f87171',
    '--theme-mesh-a': 'hsla(8,80%,15%,0.7)',
    '--theme-mesh-b': 'hsla(0,70%,12%,0.5)',
    '--theme-mesh-c': 'hsla(25,60%,12%,0.4)',
  },
  matrix: {
    '--background': '0 0% 3%',
    '--foreground': '120 60% 88%',
    '--card': '0 0% 6%',
    '--card-foreground': '120 60% 88%',
    '--popover': '0 0% 6%',
    '--popover-foreground': '120 60% 88%',
    '--primary': '120 100% 45%',
    '--primary-foreground': '0 0% 3%',
    '--secondary': '0 0% 10%',
    '--secondary-foreground': '120 40% 70%',
    '--muted': '0 0% 9%',
    '--muted-foreground': '120 15% 45%',
    '--accent': '90 80% 48%',
    '--accent-foreground': '0 0% 3%',
    '--destructive': '0 84% 55%',
    '--destructive-foreground': '120 60% 92%',
    '--border': '120 20% 12%',
    '--input': '120 20% 10%',
    '--ring': '120 100% 45%',
    '--radius': '0.25rem',
    '--theme-edge-glow': '#4ade80',
    '--theme-mesh-a': 'hsla(120,60%,8%,0.9)',
    '--theme-mesh-b': 'hsla(0,0%,0%,0.7)',
    '--theme-mesh-c': 'hsla(90,60%,8%,0.5)',
  },
  light: {
    '--background': '210 40% 98%',
    '--foreground': '222 47% 11%',
    '--card': '0 0% 100%',
    '--card-foreground': '222 47% 11%',
    '--popover': '0 0% 100%',
    '--popover-foreground': '222 47% 11%',
    '--primary': '210 90% 50%',
    '--primary-foreground': '210 40% 98%',
    '--secondary': '210 40% 96%',
    '--secondary-foreground': '222 47% 11%',
    '--muted': '210 40% 96%',
    '--muted-foreground': '215 16% 47%',
    '--accent': '262 72% 58%',
    '--accent-foreground': '210 40% 98%',
    '--destructive': '0 84% 60%',
    '--destructive-foreground': '210 40% 98%',
    '--border': '214 32% 91%',
    '--input': '214 32% 91%',
    '--ring': '210 90% 50%',
    '--radius': '0.6rem',
    '--theme-edge-glow': '#60a5fa',
    '--theme-mesh-a': 'hsla(210,60%,90%,0.6)',
    '--theme-mesh-b': 'hsla(262,60%,90%,0.4)',
    '--theme-mesh-c': 'hsla(210,100%,95%,0.5)',
  },
};

interface ThemeContextValue {
  theme: AppTheme;
  setTheme: (t: AppTheme) => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<AppTheme>('light');

  // Hydrate from localStorage on mount (only override default if user previously chose a theme)
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem('rift-theme') as AppTheme | null;
      if (stored && THEMES.some(t => t.id === stored)) {
        setThemeState(stored);
      }
    } catch { /* ignore */ }
  }, []);

  // Apply theme by injecting inline CSS variables directly onto <html>
  // Using inline style ensures maximum specificity (overrides everything).
  useEffect(() => {
    const root = document.documentElement;
    const vars = THEME_VARS[theme];

    // Set each CSS variable directly as an inline style on <html>
    Object.entries(vars).forEach(([key, val]) => {
      root.style.setProperty(key, val);
    });

    // Also compute and set the Tailwind color tokens (--color-*) directly
    // so Tailwind utility classes like bg-background, text-foreground etc reflect the theme
    root.style.setProperty('--color-background', `hsl(${vars['--background']})`);
    root.style.setProperty('--color-foreground', `hsl(${vars['--foreground']})`);
    root.style.setProperty('--color-card', `hsl(${vars['--card']})`);
    root.style.setProperty('--color-card-foreground', `hsl(${vars['--card-foreground']})`);
    root.style.setProperty('--color-popover', `hsl(${vars['--popover']})`);
    root.style.setProperty('--color-popover-foreground', `hsl(${vars['--popover-foreground']})`);
    root.style.setProperty('--color-primary', `hsl(${vars['--primary']})`);
    root.style.setProperty('--color-primary-foreground', `hsl(${vars['--primary-foreground']})`);
    root.style.setProperty('--color-secondary', `hsl(${vars['--secondary']})`);
    root.style.setProperty('--color-secondary-foreground', `hsl(${vars['--secondary-foreground']})`);
    root.style.setProperty('--color-muted', `hsl(${vars['--muted']})`);
    root.style.setProperty('--color-muted-foreground', `hsl(${vars['--muted-foreground']})`);
    root.style.setProperty('--color-accent', `hsl(${vars['--accent']})`);
    root.style.setProperty('--color-accent-foreground', `hsl(${vars['--accent-foreground']})`);
    root.style.setProperty('--color-destructive', `hsl(${vars['--destructive']})`);
    root.style.setProperty('--color-destructive-foreground', `hsl(${vars['--destructive-foreground']})`);
    root.style.setProperty('--color-border', `hsl(${vars['--border']})`);
    root.style.setProperty('--color-input', `hsl(${vars['--input']})`);
    root.style.setProperty('--color-ring', `hsl(${vars['--ring']})`);

    // Dark/light class for any components that check it
    if (theme === 'light') {
      root.classList.remove('dark');
      root.classList.add('light');
    } else {
      root.classList.add('dark');
      root.classList.remove('light');
    }

    root.setAttribute('data-theme', theme);

    try { window.localStorage.setItem('rift-theme', theme); } catch { /* ignore */ }
  }, [theme]);

  const setTheme = useCallback((t: AppTheme) => setThemeState(t), []);

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside ThemeProvider');
  return ctx;
}
