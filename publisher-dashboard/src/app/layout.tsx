import type { Metadata } from 'next';
import AdminShell from './admin-shell';
import './globals.css';

export const metadata: Metadata = {
  title: 'Publisher Dashboard',
  description: 'Content management dashboard',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ta">
      <body>
        <AdminShell>{children}</AdminShell>
      </body>
    </html>
  );
}
