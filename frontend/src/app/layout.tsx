import type { Metadata, Viewport } from "next";
import { Noto_Sans_Tamil, Mukta_Malar } from "next/font/google";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import PopularArticles from "@/components/ui/PopularArticles";
import ThemeProvider from "@/components/ui/ThemeProvider";
import ScrollToTop from "@/components/ui/ScrollToTop";
import { UserAuthProvider } from "@/contexts/UserAuthContext";
import { SiteSettingsPreviewProvider } from "@/contexts/SiteSettingsPreviewContext";
import { getCategories, getSiteSettings, parseThemeColors } from "@/services/api";
import type { Category, SiteSettings } from "@/services/api";
import GoogleAnalytics from "@/components/ui/GoogleAnalytics";
import "./globals.css";

const notoSansTamil = Noto_Sans_Tamil({
  variable: "--font-noto-sans-tamil",
  subsets: ["tamil"],
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

const muktaMalar = Mukta_Malar({
  variable: "--font-mukta-malar",
  subsets: ["tamil"],
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

/**
 * Absolute base for every generated metadata URL (canonical links, Open Graph
 * URLs, `sizes`-less image references). Without it Next.js falls back to
 * `http://localhost:<port>`, which would emit `localhost` links into the
 * production head. The value is parsed defensively so a malformed env var
 * degrades to the local dev URL instead of failing the whole build.
 */
function resolveMetadataBase(): URL {
  try {
    return new URL(process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000');
  } catch {
    return new URL('http://localhost:3000');
  }
}

export async function generateMetadata(): Promise<Metadata> {
  const defaults: Metadata = {
    metadataBase: resolveMetadataBase(),
    title: "OORUM URAVUM – ஒன்று பட்டால் உண்டு வாழ்வு",
    description: "தமிழ் செய்திகள் — செய்திகள், உடல் நலம், தொழில்நுட்பம், படைப்பாக்கம்",
  };
  try {
    const settings = await getSiteSettings();
    return {
      ...defaults,
      title: settings.siteTitle || defaults.title,
      description: settings.siteDescription || defaults.description,
    };
  } catch (error) {
    console.error('[layout] Failed to load site metadata settings:', error);
    return defaults;
  }
}

export async function generateViewport(): Promise<Viewport> {
  let themeColor = '#285430';
  try {
    const settings = await getSiteSettings();
    themeColor = parseThemeColors(settings.themeColors)?.primaryDark ?? themeColor;
  } catch (error) {
    console.error('[layout] Failed to load viewport theme color:', error);
  }

  return {
    width: "device-width",
    initialScale: 1,
    viewportFit: "cover",
    themeColor,
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [initialCategories, settings] = await Promise.all([
    getCategories().catch((error: unknown) => {
      console.error('[layout] Failed to load header categories:', error);
      return [] as Category[];
    }),
    getSiteSettings().catch((error: unknown): SiteSettings => {
      console.error('[layout] Failed to load site settings:', error);
      return { analyticsId: '' };
    }),
  ]);
  const initialThemeColors = parseThemeColors(settings.themeColors);

  return (
    <html
      lang="ta"
      dir="ltr"
      className={`${notoSansTamil.variable} ${muktaMalar.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans">
        <UserAuthProvider>
          <SiteSettingsPreviewProvider>
            <ThemeProvider initialColors={initialThemeColors}>
              <Header initialCategories={initialCategories} />
              <main className="flex-1">{children}</main>
              <PopularArticles />
              <Footer />
              <GoogleAnalytics initialMeasurementId={settings.analyticsId} />
              <ScrollToTop />
            </ThemeProvider>
          </SiteSettingsPreviewProvider>
        </UserAuthProvider>
      </body>
    </html>
  );
}
