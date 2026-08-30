'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Bell, CheckCheck, Loader2, PackageOpen, Sparkles } from 'lucide-react';
import { apiGet } from '@/lib/api';

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const loadNotifications = async () => {
    try {
      const res = await apiGet('/meta/notifications');
      const items = res?.data?.items || res?.data || [];
      setNotifications(Array.isArray(items) ? items : []);
    } catch {
      setNotifications([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadNotifications();
    const timer = setInterval(loadNotifications, 20000);
    return () => clearInterval(timer);
  }, []);

  const markAllRead = () => {
    setNotifications((prev) => prev.map((n: any) => ({ ...n, unread: false })));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Bell className="w-5 h-5 text-indigo-400" /> Bildirishnomalar
          </h2>
          <p className="text-xs text-slate-400 mt-1">Barcha tizim bildirishnomalari va ogohlantirishlar.</p>
        </div>
        <button
          onClick={markAllRead}
          className="px-4 py-2.5 rounded-xl bg-slate-800/60 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white font-medium text-xs transition-all flex items-center gap-2"
        >
          <CheckCheck className="w-4 h-4" /> Barchasini o&apos;qilgan qilish
        </button>
      </div>

      {loading ? (
        <div className="glass-panel p-12 rounded-2xl border border-slate-800 flex justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-indigo-400" />
        </div>
      ) : notifications.length === 0 ? (
        <div className="glass-panel p-12 rounded-2xl border border-slate-800 text-center">
          <PackageOpen className="w-16 h-16 text-slate-600 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-white mb-2">Bildirishnomalar yo&apos;q</h3>
          <p className="text-sm text-slate-400">Yangi buyurtma yoki operator so&apos;rovlari shu yerda ko&apos;rinadi.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {notifications.map((n: any, i: number) => (
            <Link
              key={i}
              href={n.link || '/dashboard'}
              className="glass-panel flex items-start gap-4 p-5 rounded-xl border border-slate-800 hover:border-indigo-500/40 hover:bg-slate-800/50 transition-all duration-300"
            >
              <span className="w-10 h-10 flex-shrink-0 flex items-center justify-center rounded-xl bg-slate-800/80 border border-slate-700/60 text-lg">
                {n.type === 'operator_request' ? '👨‍💼' : n.type === 'new_order' ? '🛒' : '✨'}
              </span>
              <div className="min-w-0 flex-1 flex flex-col gap-1">
                <div className="text-sm font-semibold text-white flex items-center gap-2 min-w-0">
                  <span className="truncate">{n.title}</span>
                  {n.unread && <span className="px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 text-[10px] font-bold flex-shrink-0 border border-indigo-500/30">Yangi</span>}
                </div>
                <div className="text-xs text-slate-400 leading-relaxed break-words">{n.body}</div>
              </div>
              <Sparkles className="w-4 h-4 text-slate-600 flex-shrink-0" />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
