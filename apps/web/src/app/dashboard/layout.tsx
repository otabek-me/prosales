import React from 'react';
import Sidebar from '../../components/Sidebar';
import Navbar from '../../components/Navbar';

// Mark the whole /dashboard/* tree as dynamic so prerendered (stale) routes are
// never served. This segment config MUST live on a Server Component (layout) —
// the child pages are `'use client'` components, which cannot carry `dynamic`/
// `revalidate` (Next.js ignores them and, for `revalidate`, raises
// "Invalid revalidate value [object Object]").
export const dynamic = 'force-dynamic';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen w-full overflow-hidden bg-[#0a0d14]">
      <Sidebar />
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        <Navbar />
        <main className="p-4 sm:p-6 lg:p-8 flex-1 overflow-y-auto">
          <div className="mx-auto max-w-[1400px] w-full animate-fade-in-up">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
