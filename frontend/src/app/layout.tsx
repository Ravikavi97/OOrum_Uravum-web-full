import type { Metadata } from "next";
import { Noto_Sans_Tamil, Mukta_Malar } from "next/font/google";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import PopularArticles from "@/components/ui/PopularArticles";
import ThemeProvider from "@/components/ui/ThemeProvider";
import ScrollToTop from "@/components/ui/ScrollToTop";
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

export const metadata: Metadata = {
  title: "OORUM URAVUM – ஒன்று பட்டால் உண்டு வாழ்வு",
  description: "தமிழ் செய்திகள் — செய்திகள், உடல் நலம், தொழில்நுட்பம், படைப்பாக்கம்",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/logo.png", type: "image/png", sizes: "192x192" },
    ],
    apple: "/logo.png",
    shortcut: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ta"
      dir="ltr"
      className={`${notoSansTamil.variable} ${muktaMalar.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans">
        <ThemeProvider>
          <Header />
          <main className="flex-1">{children}</main>
          <PopularArticles />
          <Footer />
          <ScrollToTop />
        </ThemeProvider>
      </body>
    </html>
  );
}
