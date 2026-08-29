'use client';

import React, { useState, useEffect } from 'react';
import { ShieldAlert, Building2, Users, CreditCard, Activity, Bot, Loader2, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { apiGet, apiPost } from '@/lib/api';

export default function SuperAdminDashboard() {
  const [metrics, setMetrics] = useState<any>(null);
  const [businesses, setBusinesses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [payments, setPayments] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'BUSINESSES' | 'PAYMENTS'>('PAYMENTS');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setError('');
      const [mRes, bRes, pRes] = await Promise.all([
        apiGet('/superadmin/metrics'),
        apiGet('/superadmin/businesses'),
        apiGet('/superadmin/payments'),
      ]);
      setMetrics(mRes.data || {});
      setBusinesses(bRes.data || []);
      setPayments(pRes.data || []);
    } catch (err: any) {
      setError(err.message || 'Superadmin huquqi talab qilinadi.');
    } finally {
      setLoading(false);
    }
  };

  const handleApprovePayment = async (paymentId: string) => {
    setActionLoading(paymentId);
    try {
      await apiPost(`/superadmin/payments/${paymentId}/approve`, {});
      await loadData();
    } catch (err: any) {
      alert(err.message || "Xatolik yuz berdi");
    } finally {
      setActionLoading(null);
    }
  };

  const handleRejectPayment = async (paymentId: string) => {
    if (!confirm("To'lovni rad etmoqchimisiz?")) return;
    setActionLoading(paymentId);
    try {
      await apiPost(`/superadmin/payments/${paymentId}/reject`, {});
      await loadData();
    } catch (err: any) {
      alert(err.message || "Xatolik yuz berdi");
    } finally {
      setActionLoading(null);
    }
  };

  const pendingPaymentsCount = payments.filter(p => p.status === 'PENDING').length;

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
          <p className="text-xs text-slate-400">Platforma bo&apos;yicha barcha bizneslar, to&apos;lovlar tasdiqlash va obunalar nazorati.</p>
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
              <span className="text-xs text-slate-400">Kutilayotgan To&apos;lovlar</span>
              <h3 className="text-xl font-bold text-amber-400 mt-1">{pendingPaymentsCount} ta</h3>
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

          {/* Navigation Tabs */}
          <div className="flex gap-2 border-b border-slate-800 pb-2">
            <button
              onClick={() => setActiveTab('PAYMENTS')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                activeTab === 'PAYMENTS'
                  ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30'
                  : 'text-slate-400 hover:text-white bg-slate-900/60'
              }`}
            >
              <CreditCard className="w-4 h-4" />
              <span>To&apos;lov So&apos;rovlari ({pendingPaymentsCount})</span>
            </button>
            <button
              onClick={() => setActiveTab('BUSINESSES')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                activeTab === 'BUSINESSES'
                  ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30'
                  : 'text-slate-400 hover:text-white bg-slate-900/60'
              }`}
            >
              <Building2 className="w-4 h-4" />
              <span>Bizneslar Ro&apos;yxati ({businesses.length})</span>
            </button>
          </div>

          {/* Tab 1: Payments Management */}
          {activeTab === 'PAYMENTS' && (
            <div className="glass-panel p-6 rounded-2xl border border-slate-800 space-y-4 shadow-xl">
              <h3 className="font-bold text-white text-base flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-purple-400" /> Bank Kartasi Orqali Tushgan To&apos;lovlar
              </h3>
              {payments.length === 0 ? (
                <div className="text-center py-12 text-slate-400 text-sm">
                  Hozircha to&apos;lov so&apos;rovlari mavjud emas.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="text-slate-400 uppercase bg-slate-900/80 border-b border-slate-800">
                      <tr>
                        <th className="px-4 py-3">Biznes Nomi</th>
                        <th className="px-4 py-3">Tarif</th>
                        <th className="px-4 py-3">Summa</th>
                        <th className="px-4 py-3">To&apos;lovchi Ismi</th>
                        <th className="px-4 py-3">Telefon</th>
                        <th className="px-4 py-3">Tranzaksiya / Izoh</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3">Sana</th>
                        <th className="px-4 py-3 text-center">Tasdiqlash</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/50">
                      {payments.map((p) => (
                        <tr key={p.id} className="hover:bg-slate-800/30 transition-colors">
                          <td className="px-4 py-3 font-semibold text-white">{p.business_name}</td>
                          <td className="px-4 py-3 font-bold text-indigo-300">{p.plan_name}</td>
                          <td className="px-4 py-3 font-bold text-emerald-400">{Number(p.amount || 0).toLocaleString()} UZS</td>
                          <td className="px-4 py-3 text-slate-200">{p.sender_name}</td>
                          <td className="px-4 py-3 text-slate-400">{p.sender_phone || '-'}</td>
                          <td className="px-4 py-3 text-slate-300 max-w-xs truncate">{p.transaction_id || p.receipt_image_url || '-'}</td>
                          <td className="px-4 py-3">
                            <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                              p.status === 'APPROVED'
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                : p.status === 'REJECTED'
                                ? 'bg-red-500/20 text-red-300 border border-red-500/30'
                                : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                            }`}>
                              {p.status === 'APPROVED' ? 'Tasdiqlangan' : p.status === 'REJECTED' ? 'Rad etilgan' : 'Kutilmoqda'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-slate-400 whitespace-nowrap">{p.created_at}</td>
                          <td className="px-4 py-3">
                            {p.status === 'PENDING' ? (
                              <div className="flex items-center justify-center gap-2">
                                <button
                                  onClick={() => handleApprovePayment(p.id)}
                                  disabled={actionLoading === p.id}
                                  className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md transition-all disabled:opacity-50"
                                >
                                  {actionLoading === p.id ? '...' : 'Tasdiqlash'}
                                </button>
                                <button
                                  onClick={() => handleRejectPayment(p.id)}
                                  disabled={actionLoading === p.id}
                                  className="px-2.5 py-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-300 font-semibold text-xs border border-red-500/30 transition-all disabled:opacity-50"
                                >
                                  Rad
                                </button>
                              </div>
                            ) : (
                              <span className="text-slate-500 text-[11px] block text-center">Bajarildi</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Tab 2: Businesses */}
          {activeTab === 'BUSINESSES' && (
            <div className="glass-panel p-6 rounded-2xl border border-slate-800 space-y-4 shadow-xl">
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
          )}
        </>
      )}
    </div>
  );
}
