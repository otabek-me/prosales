'use client';

import React, { useState, useEffect } from 'react';
import { Store, Bell, Search, User, LogOut, MessageSquare, AlertTriangle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { clearToken, apiGet } from '@/lib/api';

export default function Navbar() {
  const router = useRouter();
  const [operatorCount, setOperatorCount] = useState(0);

  useEffect(() => {
    checkAlerts();
    const interval = setInterval(checkAlerts, 5000);
    return () => clearInterval(interval);
  }, []);

  const checkAlerts = async () => {
    try {
      const res = await apiGet('/conversations');
      const list = res.data || [];
      const opRequests = list.filter((c: any) => c.is_operator_mode && c.unread_count > 0).length;
      setOperatorCount(opRequests);
    } catch {
      // ignore
    }
  };

  const handleLogout = () => {
    clearToken();
    localStorage.removeItem('org_id');
    router.push('/login');
  };

  return (
    <header className="h-16 glass-panel border-b border-slate-800 px-6 flex items-center justify-between sticky top-0 z-30">
      {/* Business Status */}
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shadow-sm">
          <Store className="w-4 h-4" />
        </div>
        <div>
          <span className="text-sm font-semibold text-white">AI Sales Assistant</span>
          <span className="ml-2 text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-medium border border-emerald-500/30">
            24/7 Faol
          </span>
        </div>
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-3">
        {/* Operator Request Alert Banner */}
        {operatorCount > 0 && (
          <Link
            href="/dashboard/inbox"
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-amber-500/20 border border-amber-500/30 text-amber-300 text-xs font-semibold hover:bg-amber-500/30 transition-all animate-pulse"
          >
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
            <span>{operatorCount} ta mijoz operator kutmoqda!</span>
          </Link>
        )}

        {/* Live Inbox Link */}
        <Link
          href="/dashboard/inbox"
          className="p-2 rounded-xl bg-slate-800/50 border border-slate-700/50 text-slate-300 hover:text-white relative transition-colors"
          title="Jonli xabarlar"
        >
          <MessageSquare className="w-4 h-4" />
          {operatorCount > 0 && (
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-amber-400 ring-2 ring-slate-900 animate-ping" />
          )}
        </Link>

        {/* User Profile + Logout */}
        <div className="flex items-center gap-3 pl-2 border-l border-slate-800">
          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-purple-500 to-indigo-500 flex items-center justify-center text-white text-xs font-bold shadow-md">
            <User className="w-4 h-4" />
          </div>
          <button
            onClick={handleLogout}
            title="Chiqish"
            className="p-2 rounded-xl bg-slate-800/50 border border-slate-700/50 text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-all"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
}
