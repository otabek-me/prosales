import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'ProSales — AI Sales SaaS Platform',
  description: 'Multi-tenant AI Sales Assistant, CRM & Telegram Bot SaaS Platform for SMBs',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="uz" className="dark">
      <body className="bg-slate-950 text-slate-100 antialiased min-h-screen">
        {children}
      </body>
    </html>
  );
}
