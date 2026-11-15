'use client';

import { useEffect, useState } from 'react';
import { getSiteSettings, parseThemeColors } from '@/services/api';
import { useSiteSettingsPreview } from '@/contexts/SiteSettingsPreviewContext';

interface ThemeColors {
  primaryDark: string;
  accentRed: string;
  background: string;
  foreground: string;
  cardBg: string;
}

export default function ThemeProvider({ children, initialColors }: { children: React.ReactNode; initialColors?: ThemeColors | null }) {
  const [colors, setColors] = useState<ThemeColors | null>(initialColors || null);
  const preview = useSiteSettingsPreview();

  useEffect(() => {
    // Fetch latest colors client-side for freshness
    getSiteSettings().then((settings) => {
      const savedColors = parseThemeColors(settings.themeColors);
      if (savedColors) setColors(savedColors);
    }).catch(() => {});
  }, []);

  const activeColors = preview?.themeColors ?? colors;

  useEffect(() => {
    if (!activeColors) return;
    const root = document.documentElement;
    root.style.setProperty('--primary-dark', activeColors.primaryDark);
    root.style.setProperty('--accent-red', activeColors.accentRed);
    root.style.setProperty('--background', activeColors.background);
    root.style.setProperty('--foreground', activeColors.foreground);
    root.style.setProperty('--card-bg', activeColors.cardBg);
  }, [activeColors]);

  return <>{children}</>;
}
