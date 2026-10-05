import type { Metadata, Viewport } from "next";
import { Noto_Sans_Tamil, Mukta_Malar } from "next/font/google";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import PopularArticles from "@/components/ui/PopularArticles";
import ThemeProvider from "@/components/ui/ThemeProvider";
import ScrollToTop from "@/components/ui/ScrollToTop";
import { UserAuthProvider } from "@/contexts/UserAuthContext";
import { getCategories } from "@/services/api";
import type { Category } from "@/services/api";
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

export const metadata: Metadata = {
  metadataBase: resolveMetadataBase(),
  title: "OORUM URAVUM – ஒன்று பட்டால் உண்டு வாழ்வு",
  description: "தமிழ் செய்திகள் — செய்திகள், உடல் நலம், தொழில்நுட்பம், படைப்பாக்கம்",
  // No `icons` field on purpose. The app-icon file conventions in this directory
  // — `favicon.ico`, `icon.svg` and `apple-icon.png` — are injected by Next.js
  // and already cover the tab, the maskable/SVG-capable browsers and iOS. Listing
  // them again here emitted five duplicate <link rel="icon"> tags, and the
  // `sizes: "192x192"` claim was wrong for the wordmark-shaped `logo.png`.
};

// Next supplies a default viewport meta, but stating it explicitly documents the
// intent and adds viewport-fit coverage for notched phones. No maximum-scale or
// user-scalable lock, so pinch-zoom stays available.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0d1b0f",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  let initialCategories: Category[] = [];
  try { initialCategories = await getCategories(); } catch { /* fallback to empty */ }

  return (
    <html
      lang="ta"
      dir="ltr"
      className={`${notoSansTamil.variable} ${muktaMalar.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans">
        <UserAuthProvider>
        <ThemeProvider>
          <Header initialCategories={initialCategories} />
          <main className="flex-1">{children}</main>
          <PopularArticles />
          <Footer />
          <ScrollToTop />
        </ThemeProvider>
        </UserAuthProvider>
      </body>
    </html>
  );
}
