'use client';

import React, { useState, useEffect } from 'react';
import {
  TrendingUp,
  MessageSquare,
  ShoppingCart,
  DollarSign,
  Bot,
  ArrowUpRight,
  Sparkles,
  ShoppingBag,
  Loader2,
  PackageOpen
} from 'lucide-react';
import Link from 'next/link';
import { apiGet } from '../../lib/api';

export default function DashboardOverview() {
  const [analytics, setAnalytics] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAnalytics();
  }, []);

  const loadAnalytics = async () => {
    try {
      setLoading(true);
      const res = await apiGet('/analytics/dashboard');
      setAnalytics(res.data || {});
    } catch (err) {
      console.error('Analytics yuklashda xatolik:', err);
      setAnalytics({});
    } finally {
      setLoading(false);
    }
  };

  const stats = [
    {
      title: "Umumiy tushum (Revenue)",
      value: analytics ? `${(analytics.total_revenue || 0).toLocaleString()} UZS` : "0 UZS",
      icon: DollarSign,
      color: "from-emerald-500 to-teal-600"
    },
    {
      title: "AI Muloqotlar",
      value: `${analytics?.total_conversations || 0} ta`,
      icon: MessageSquare,
      color: "from-indigo-500 to-blue-600"
    },
    {
      title: "Buyurtmalar",
      value: `${analytics?.total_orders || 0} ta`,
      icon: ShoppingCart,
      color: "from-purple-500 to-pink-600"
    },
    {
      title: "AI Autonomy Rate",
      value: `${analytics?.ai_handled_rate || 0}%`,
      icon: Bot,
      color: "from-amber-500 to-orange-600"
    },
  ];

  const recentOrders = analytics?.recent_orders || [];

  const statusColors: Record<string, string> = {
    PENDING: "bg-yellow-500/20 text-yellow-400",
    CONFIRMED: "bg-blue-500/20 text-blue-400",
    PROCESSING: "bg-indigo-500/20 text-indigo-400",
    SHIPPED: "bg-purple-500/20 text-purple-400",
    DELIVERED: "bg-emerald-500/20 text-emerald-400",
    CANCELLED: "bg-red-500/20 text-red-400",
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="gradient-border rounded-2xl">
        <div className="glass-panel p-6 md:p-8 rounded-xl relative overflow-hidden flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="absolute -top-20 -left-20 w-72 h-72 bg-indigo-600/20 rounded-full blur-3xl pointer-events-none" />
          <div className="z-10 relative">
            <div className="flex items-center gap-2 mb-3">
              <span className="px-3 py-1 text-xs font-semibold rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-indigo-400" /> AI Sales Assistant
              </span>
            </div>
            <h2 className="text-3xl font-bold text-white font-display tracking-tight">Boshqaruv Paneli 👋</h2>
            <p className="text-sm text-slate-400 mt-2">AI sotuvlar ko&apos;rsatkichi va Telegram muloqotlari statistikasi.</p>
          </div>

          <div className="flex items-center gap-3 z-10 relative">
            <Link
              href="/dashboard/inbox"
              className="px-4 py-2.5 rounded-xl btn-primary text-white font-medium text-sm flex items-center gap-2"
            >
              <MessageSquare className="w-4 h-4" /> Live Inbox
            </Link>
          <Link
            href="/dashboard/products"
            className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium text-sm transition-all border border-slate-700 flex items-center gap-2"
          >
            <ShoppingBag className="w-4 h-4" /> Mahsulot qo&apos;shish
          </Link>
        </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((item, idx) => {
          const Icon = item.icon;
          return (
            <div key={idx} className="glass-card p-5 rounded-2xl border border-slate-800 relative overflow-hidden group hover:border-indigo-500/40 transition-all stagger">
              {/* ambient corner glow */}
              <div className={`absolute -top-10 -right-10 w-28 h-28 rounded-full bg-gradient-to-br ${item.color} opacity-20 blur-2xl group-hover:opacity-35 transition-opacity`} />
              <div className="relative flex items-center justify-between">
                <span className="text-xs font-medium text-slate-400 font-display">{item.title}</span>
                <div className={`w-9 h-9 rounded-xl bg-gradient-to-tr ${item.color} flex items-center justify-center shadow-md shadow-black/30`}>
                  <Icon className="w-5 h-5 text-white" />
                </div>
              </div>
                            <div className="mt-2 flex items-center justify-between relative">
                <h3 className="text-2xl font-bold text-white font-display tracking-tight">{item.value}</h3>
              </div>
              <div className="mt-2 h-1 w-full bg-slate-800/50 rounded-full overflow-hidden relative">
                <div className={`h-full rounded-full bg-gradient-to-r ${item.color} opacity-70`} style={{ width: `${45 + idx * 14}%` }} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Recent Orders */}
      <div className="gradient-border rounded-2xl">
        <div className="glass-panel p-6 rounded-xl border border-slate-800">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2 font-display">
            <div className="w-8 h-8 rounded-lg bg-indigo-600/20 text-indigo-400 flex items-center justify-center"><ShoppingCart className="w-4 h-4" /></div>
            So&apos;nggi buyurtmalar
          </h3>
          <Link href="/dashboard/orders" className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 group">
            Barchasini ko&apos;rish <ArrowUpRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
          </Link>
        </div>

        {recentOrders.length === 0 ? (
          <div className="text-center py-12">
            <PackageOpen className="w-12 h-12 text-slate-600 mx-auto mb-3" />
            <p className="text-slate-400 text-sm">Hozircha buyurtmalar yo&apos;q</p>
            <p className="text-slate-500 text-xs mt-1">Telegram bot orqali mijozlar buyurtma berganida shu yerda ko&apos;rinadi</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-500 border-b border-slate-800">
                  <th className="pb-3 font-medium">Buyurtma</th>
                  <th className="pb-3 font-medium">Mijoz</th>
                  <th className="pb-3 font-medium">Summa</th>
                  <th className="pb-3 font-medium">Status</th>
                  <th className="pb-3 font-medium">Vaqt</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {recentOrders.map((order: any) => (
                  <tr key={order.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-3 text-white font-medium">{order.order_number}</td>
                    <td className="py-3 text-slate-300">{order.customer_name || '-'}</td>
                    <td className="py-3 text-white font-medium">{Number(order.total_amount || 0).toLocaleString()} UZS</td>
                    <td className="py-3">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${statusColors[order.status] || 'bg-slate-700 text-slate-300'}`}>
                        {order.status}
                      </span>
                    </td>
                    <td className="py-3 text-slate-400 text-xs">
                      {order.created_at ? new Date(order.created_at).toLocaleDateString('uz') : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        </div>
      </div>
    </div>
  );
}
