'use client';

import React, { useState, useEffect } from 'react';
import { ShieldAlert, Building2, Users, CreditCard, Activity, Bot, Loader2, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { apiGet } from '@/lib/api';

export default function SuperAdminDashboard() {
  const [metrics, setMetrics] = useState<any>(null);
  const [businesses, setBusinesses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setError('');
      const [mRes, bRes] = await Promise.all([
        apiGet('/superadmin/metrics'),
        apiGet('/superadmin/businesses'),
      ]);
      setMetrics(mRes.data || {});
      setBusinesses(bRes.data || []);
    } catch (err: any) {
      setError(err.message || 'Superadmin huquqi talab qilinadi.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 space-y-6">
      <div className="flex justify-between items-center pb-4 border-b border-slate-800">
        <div>
          <h1 className="text-2xl font-bold text-purple-400 flex items-center gap-2">
            <ShieldAlert className="w-6 h-6" /> Super Admin SaaS Boshqaruvi
          </h1>
          <p className="text-xs text-slate-400">Platforma bo&apos;yicha barcha bizneslar, obunalar va tizim salomatligi.</p>
        </div>
        <Link href="/dashboard" className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 flex items-center gap-1.5 transition-all">
          <ArrowLeft className="w-4 h-4" /> Boshqaruv paneliga qaytish
        </Link>
      </div>

      {error ? (
        <div className="glass-panel p-8 rounded-2xl border border-red-500/30 text-center max-w-lg mx-auto">
          <ShieldAlert className="w-12 h-12 text-red-400 mx-auto mb-3" />
          <h3 className="text-lg font-bold text-white mb-2">Ruxsat Cheklangan</h3>
          <p className="text-xs text-slate-400 mb-4">{error}</p>
          <Link href="/dashboard" className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white">
            Dashboardga o&apos;tish
          </Link>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="glass-panel p-5 rounded-2xl border border-slate-800">
              <span className="text-xs text-slate-400">Jami Bizneslar (Tenants)</span>
              <h3 className="text-xl font-bold text-white mt-1">{metrics?.total_businesses || 0} ta</h3>
            </div>
            <div className="glass-panel p-5 rounded-2xl border border-slate-800">
              <span className="text-xs text-slate-400">Jami Foydalanuvchilar</span>
              <h3 className="text-xl font-bold text-indigo-400 mt-1">{metrics?.total_users || 0} ta</h3>
            </div>
            <div className="glass-panel p-5 rounded-2xl border border-slate-800">
              <span className="text-xs text-slate-400">Ulangan Telegram Botlar</span>
              <h3 className="text-xl font-bold text-cyan-400 mt-1">{metrics?.total_connected_bots || 0} ta</h3>
            </div>
            <div className="glass-panel p-5 rounded-2xl border border-slate-800">
              <span className="text-xs text-slate-400">Tizim Statusi</span>
              <h3 className="text-xl font-bold text-emerald-400 mt-1 flex items-center gap-1.5">
                <Activity className="w-5 h-5" /> {metrics?.system_health || '100% Faol'}
              </h3>
            </div>
          </div>

          <div className="glass-panel p-6 rounded-2xl border border-slate-800 space-y-4">
            <h3 className="font-bold text-white text-base">Ro&apos;yxatdan O&apos;tgan Bizneslar (Organizations)</h3>
            {businesses.length === 0 ? (
              <div className="text-center py-8 text-slate-400 text-sm">
                Hozircha ro&apos;yxatdan o&apos;tgan bizneslar yo&apos;q
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="text-slate-400 uppercase bg-slate-900/80 border-b border-slate-800">
                    <tr>
                      <th className="px-4 py-3">Biznes Nomi</th>
                      <th className="px-4 py-3">Slug</th>
                      <th className="px-4 py-3">Kategoriya</th>
                      <th className="px-4 py-3">Telefon</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Ro&apos;yxatdan o&apos;tgan</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/50">
                    {businesses.map((b) => (
                      <tr key={b.id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="px-4 py-3 font-semibold text-white">{b.name}</td>
                        <td className="px-4 py-3 font-mono text-slate-400">{b.slug}</td>
                        <td className="px-4 py-3 text-slate-300">{b.category || '-'}</td>
                        <td className="px-4 py-3 text-slate-300">{b.phone || '-'}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            b.is_active ? 'bg-emerald-500/20 text-emerald-300' : 'bg-red-500/20 text-red-300'
                          }`}>
                            {b.is_active ? 'Faol' : 'Nofaol'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-400">
                          {b.created_at ? new Date(b.created_at).toLocaleDateString('uz') : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
