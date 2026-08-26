import React from 'react';
import Sidebar from '../../components/Sidebar';
import Navbar from '../../components/Navbar';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-slate-950 flex">
      <Sidebar />
      <div className="flex-1 ml-64 flex flex-col min-w-0">
        <Navbar />
        <main className="p-6 flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
