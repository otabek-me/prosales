import React from 'react';
import Sidebar from '../../components/Sidebar';
import Navbar from '../../components/Navbar';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen app-shell bg-slate-950">
      <Sidebar />
      <div className="flex flex-col min-h-screen w-full md:pl-64">
        <Navbar />
        <main className="p-4 sm:p-6 lg:p-8 flex-1 w-full overflow-y-auto">
          <div className="mx-auto max-w-[1400px] w-full animate-fade-in-up">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
