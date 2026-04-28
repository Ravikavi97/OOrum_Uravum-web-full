import type { Metadata } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

export const metadata: Metadata = {
  title: "தேடல் - ஊரும் உறவும்",
  description: "தமிழ் செய்திகளைத் தேடுங்கள்",
  alternates: { canonical: `${SITE_URL}/search` },
};

export default function SearchLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
