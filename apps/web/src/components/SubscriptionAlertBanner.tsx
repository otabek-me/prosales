'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { AlertTriangle, Clock, ArrowRight, ShieldAlert } from 'lucide-react';
import { apiGet } from '@/lib/api';

export default function SubscriptionAlertBanner() {
  const [sub, setSub] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSub();
    const interval = setInterval(loadSub, 60000); // Check every minute
    return () => clearInterval(interval);
  }, []);

  const loadSub = async () => {
    try {
      const res = await apiGet('/subscriptions/current');
      if (res?.data) {
        setSub(res.data);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  if (loading || !sub) return null;

  const isExpired = sub.status === 'EXPIRED' || sub.is_active === false || sub.days_left <= 0;
  const isExpiringSoon = !isExpired && sub.days_left <= 3;

  if (!isExpired && !isExpiringSoon) return null;

  if (isExpired) {
    return (
      <div className="mb-5 p-4 rounded-2xl bg-gradient-to-r from-red-950/80 via-red-900/60 to-rose-950/80 border border-red-500/50 shadow-xl shadow-red-950/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-fade-in">
        <div className="flex items-start sm:items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-red-500/20 text-red-400 flex items-center justify-center shrink-0 border border-red-500/30">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-white flex items-center gap-2">
              ⚠️ Tarifingiz muddati yakunlangan!
            </h4>
            <p className="text-xs text-red-200/90 mt-0.5 leading-relaxed">
              Mahsulot qo&apos;shish, media yuklash va Telegram bot AI savdo xizmati to&apos;xtatildi. Xizmatlarni davom ettirish uchun tarifni faollashtiring.
            </p>
          </div>
        </div>
        <Link
          href="/dashboard/billing"
          className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs transition-all shadow-lg shadow-red-600/30 shrink-0 flex items-center gap-1.5"
        >
          <span>Tarifni Yangilash</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    );
  }

  // Expiring soon (3 days or less)
  return (
    <div className="mb-5 p-3.5 rounded-2xl bg-gradient-to-r from-amber-950/70 via-amber-900/50 to-orange-950/70 border border-amber-500/40 shadow-lg shadow-amber-950/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-fade-in">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0 border border-amber-500/30">
          <Clock className="w-4 h-4" />
        </div>
        <div>
          <h4 className="text-xs sm:text-sm font-bold text-white">
            Tarifingiz muddati tugashiga {sub.days_left} kun qoldi!
          </h4>
          <p className="text-[11px] text-amber-200/80 mt-0.5">
            Xizmatlar to&apos;xtab qolmasligi uchun obunani oldindan uzaytirishni tavsiya qilamiz.
          </p>
        </div>
      </div>
      <Link
        href="/dashboard/billing"
        className="px-3.5 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-semibold text-xs transition-all shrink-0 flex items-center gap-1.5"
      >
        <span>Obunani Uzaytirish</span>
        <ArrowRight className="w-3 h-3" />
      </Link>
    </div>
  );
}
