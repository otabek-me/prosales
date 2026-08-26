'use client';

import React, { useState, useEffect } from 'react';
import { TrendingUp, MessageSquare, ShoppingCart, DollarSign, Users, Bot, Loader2 } from 'lucide-react';
import { apiGet } from '@/lib/api';

export default function AnalyticsPage() {
  const [data, setData] = useState<any>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAnalytics();
  }, []);

  const loadAnalytics = async () => {
    try {
      setLoading(true);
      const res = await apiGet('/analytics/dashboard');
      setData(res.data || {});
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const statCards = [
    { label: "Umumiy tushum", value: `${Number(data.total_revenue || 0).toLocaleString()} UZS`, icon: DollarSign, color: "from-emerald-500 to-teal-600" },
    { label: "Jami suhbatlar", value: data.total_conversations || 0, icon: MessageSquare, color: "from-indigo-500 to-blue-600" },
    { label: "Jami buyurtmalar", value: data.total_orders || 0, icon: ShoppingCart, color: "from-purple-500 to-pink-600" },
    { label: "Jami mijozlar", value: data.total_customers || 0, icon: Users, color: "from-cyan-500 to-blue-600" },
    { label: "AI Autonomy Rate", value: `${data.ai_handled_rate || 0}%`, icon: Bot, color: "from-amber-500 to-orange-600" },
  ];

  const funnel: Record<string, any> = data.sales_funnel || {};
  const funnelStages = [
    { key: 'NEW', label: 'Yangi', color: 'bg-blue-500' },
    { key: 'INTERESTED', label: 'Qiziqgan', color: 'bg-cyan-500' },
    { key: 'CONSIDERING', label: "O'ylayapti", color: 'bg-yellow-500' },
    { key: 'READY_TO_BUY', label: 'Sotib olishga tayyor', color: 'bg-emerald-500' },
    { key: 'ORDERED', label: 'Buyurtma berdi', color: 'bg-purple-500' },
    { key: 'COMPLETED', label: 'Tugallangan', color: 'bg-green-500' },
  ];

  const totalFunnel: number = Object.values(funnel).reduce((sum: number, v: any) => sum + (Number(v) || 0), 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-indigo-400" /> Tahlil va Statistika
        </h2>
        <p className="text-xs text-slate-400 mt-1">Platformaning umumiy ko&apos;rsatkichlari.</p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        {statCards.map((card, i) => {
          const Icon = card.icon;
          return (
            <div key={i} className="glass-card p-5 rounded-2xl border border-slate-800 hover:border-slate-700 transition-all">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs text-slate-400">{card.label}</span>
                <div className={`w-8 h-8 rounded-lg bg-gradient-to-tr ${card.color} flex items-center justify-center`}>
                  <Icon className="w-4 h-4 text-white" />
                </div>
              </div>
              <p className="text-xl font-bold text-white">{card.value}</p>
            </div>
          );
        })}
      </div>

      {/* Sales Funnel */}
      <div className="glass-panel p-6 rounded-2xl border border-slate-800">
        <h3 className="text-base font-semibold text-white mb-4">Savdo Hunisi (Sales Funnel)</h3>
        {totalFunnel === 0 ? (
          <div className="text-center py-8">
            <p className="text-slate-400 text-sm">Hozircha mijozlar yo&apos;q</p>
            <p className="text-slate-500 text-xs mt-1">Telegram bot orqali mijozlar kelib qo&apos;shilganida statistika ko&apos;rinadi</p>
          </div>
        ) : (
          <div className="space-y-3">
            {funnelStages.map((stage) => {
              const count = Number(funnel[stage.key] || 0);
              const pct = totalFunnel > 0 ? Math.round((count / totalFunnel) * 100) : 0;
              return (
                <div key={stage.key} className="flex items-center gap-3">
                  <span className="text-xs text-slate-400 w-36 flex-shrink-0">{stage.label}</span>
                  <div className="flex-1 h-2 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${stage.color} rounded-full transition-all duration-700`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="text-xs text-white font-medium w-8 text-right">{count}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Recent Orders */}
      {data.recent_orders?.length > 0 && (
        <div className="glass-panel p-6 rounded-2xl border border-slate-800">
          <h3 className="text-base font-semibold text-white mb-4">So&apos;nggi buyurtmalar</h3>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-slate-500 text-left border-b border-slate-800">
                <th className="pb-2 font-medium">Buyurtma</th>
                <th className="pb-2 font-medium">Summa</th>
                <th className="pb-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {data.recent_orders.map((o: any) => (
                <tr key={o.id}>
                  <td className="py-2 text-white">{o.order_number}</td>
                  <td className="py-2 text-white">{Number(o.total_amount || 0).toLocaleString()} UZS</td>
                  <td className="py-2">
                    <span className="px-2 py-0.5 rounded-full text-xs bg-slate-700 text-slate-300">{o.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
