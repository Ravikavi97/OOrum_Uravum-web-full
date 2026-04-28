'use client';

import { useEffect, useState } from 'react';
import { getSiteSettings } from '@/services/api';

interface ThemeColors {
  primaryDark: string;
  accentRed: string;
  background: string;
  foreground: string;
  cardBg: string;
}

export default function ThemeProvider({ children, initialColors }: { children: React.ReactNode; initialColors?: ThemeColors | null }) {
  const [colors, setColors] = useState<ThemeColors | null>(initialColors || null);

  useEffect(() => {
    // Fetch latest colors client-side for freshness
    getSiteSettings().then((settings) => {
      if (settings.themeColors) {
        try { setColors(JSON.parse(settings.themeColors)); } catch { /* ignore */ }
      }
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!colors) return;
    const root = document.documentElement;
    root.style.setProperty('--primary-dark', colors.primaryDark);
    root.style.setProperty('--accent-red', colors.accentRed);
    root.style.setProperty('--background', colors.background);
    root.style.setProperty('--foreground', colors.foreground);
    root.style.setProperty('--card-bg', colors.cardBg);
  }, [colors]);

  return <>{children}</>;
}
