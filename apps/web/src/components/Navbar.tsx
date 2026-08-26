'use client';

import React from 'react';
import { Store, Bell, Search, Globe, User, LogOut } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { clearToken, setOrgId } from '@/lib/api';

export default function Navbar() {
  const router = useRouter();

  const handleLogout = () => {
    clearToken();
    localStorage.removeItem('org_id');
    router.push('/login');
  };

  return (
    <header className="h-16 glass-panel border-b border-slate-800 px-6 flex items-center justify-between sticky top-0 z-30">
      {/* Business Selector */}
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
          <Store className="w-4 h-4" />
        </div>
        <div>
          <span className="text-sm font-semibold text-white">AI Sales Dashboard</span>
          <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-medium">
            Faol
          </span>
        </div>
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-4">
        {/* Search */}
        <div className="relative hidden md:block">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="Qidirish..."
            className="pl-9 pr-4 py-1.5 rounded-xl bg-slate-900/60 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 w-48"
          />
        </div>

        {/* Notifications */}
        <button className="p-2 rounded-xl bg-slate-800/40 border border-slate-700/50 text-slate-300 hover:text-white relative">
          <Bell className="w-4 h-4" />
        </button>

        {/* User Profile + Logout */}
        <div className="flex items-center gap-3 pl-2 border-l border-slate-800">
          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-purple-500 to-indigo-500 flex items-center justify-center text-white text-xs font-bold shadow-md">
            <User className="w-4 h-4" />
          </div>
          <button
            onClick={handleLogout}
            title="Chiqish"
            className="p-2 rounded-xl bg-slate-800/40 border border-slate-700/50 text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-all"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
}
