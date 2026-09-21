'use client';

import React, { useState, useEffect } from 'react';
import {
  ShieldAlert, Building2, Users, CreditCard, Activity, Bot, Loader2, ArrowLeft,
  UserPlus, CheckCircle2, XCircle, Clock, Search, RefreshCw, Sparkles, ShieldCheck,
  Calendar, Phone, Mail, UserCheck, AlertTriangle, Key, Plus
} from 'lucide-react';
import Link from 'next/link';
import { apiGet, apiPost, apiDelete } from '@/lib/api';

export default function SuperAdminDashboard() {
  const [metrics, setMetrics] = useState<any>(null);
  const [businesses, setBusinesses] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [admins, setAdmins] = useState<any[]>([]);
  const [plans, setPlans] = useState<any[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [activeTab, setActiveTab] = useState<'PAYMENTS' | 'BUSINESSES' | 'ADMINS'>('PAYMENTS');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Modals state
  const [showAddAdminModal, setShowAddAdminModal] = useState(false);
  const [adminFormData, setAdminFormData] = useState({
    full_name: '',
    email: '',
    password: '',
    phone: ''
  });
  const [grantEmail, setGrantEmail] = useState('');

  const [showSubModal, setShowSubModal] = useState(false);
  const [selectedBusiness, setSelectedBusiness] = useState<any>(null);
  const [subFormData, setSubFormData] = useState({
    plan_slug: 'starter',
    extend_days: 30
  });

  useEffect(() => {
    loadData();
  }, []);

  const showNotification = (msg: string, isErr = false) => {
    if (isErr) {
      setError(msg);
      setTimeout(() => setError(''), 5000);
    } else {
      setSuccess(msg);
      setTimeout(() => setSuccess(''), 5000);
    }
  };

  const loadData = async () => {
    try {
      setLoading(true);
      setError('');
      const [mRes, bRes, pRes, aRes, plRes] = await Promise.all([
        apiGet('/superadmin/metrics').catch(() => ({ data: {} })),
        apiGet('/superadmin/businesses').catch(() => ({ data: [] })),
        apiGet('/superadmin/payments').catch(() => ({ data: [] })),
        apiGet('/superadmin/admins').catch(() => ({ data: [] })),
        apiGet('/subscriptions/plans').catch(() => ({ data: [] })),
      ]);
      setMetrics(mRes.data || {});
      setBusinesses(bRes.data || []);
      setPayments(pRes.data || []);
      setAdmins(aRes.data || []);
      setPlans(plRes.data || []);
    } catch (err: any) {
      setError(err.message || 'Superadmin huquqi talab qilinadi.');
    } finally {
      setLoading(false);
    }
  };

  // Payment Actions
  const handleApprovePayment = async (paymentId: string) => {
    setActionLoading(paymentId);
    try {
      await apiPost(`/superadmin/payments/${paymentId}/approve`, {});
      showNotification("To'lov tasdiqlandi va obuna faollashtirildi!");
      await loadData();
    } catch (err: any) {
      showNotification(err.message || "Xatolik yuz berdi", true);
    } finally {
      setActionLoading(null);
    }
  };

  const handleRejectPayment = async (paymentId: string) => {
    if (!confirm("Ushbu to'lov so'rovini rad etmoqchimisiz?")) return;
    setActionLoading(paymentId);
    try {
      await apiPost(`/superadmin/payments/${paymentId}/reject`, {});
      showNotification("To'lov so'rovi rad etildi.");
      await loadData();
    } catch (err: any) {
      showNotification(err.message || "Xatolik yuz berdi", true);
    } finally {
      setActionLoading(null);
    }
  };

  // Business Actions
  const handleToggleBusinessStatus = async (orgId: string, currentName: string) => {
    setActionLoading(`biz_${orgId}`);
    try {
      const res = await apiPost(`/superadmin/businesses/${orgId}/toggle-status`, {});
      showNotification(res.data?.message || `"${currentName}" holati o'zgartirildi.`);
      await loadData();
    } catch (err: any) {
      showNotification(err.message || "Xatolik yuz berdi", true);
    } finally {
      setActionLoading(null);
    }
  };

  const handleOpenSubModal = (b: any) => {
    setSelectedBusiness(b);
    setSubFormData({
      plan_slug: b.subscription?.plan_id ? 'pro' : 'starter',
      extend_days: 30
    });
    setShowSubModal(true);
  };

  const handleSaveBusinessSub = async () => {
    if (!selectedBusiness) return;
    setActionLoading('sub_save');
    try {
      const res = await apiPost(`/superadmin/businesses/${selectedBusiness.id}/subscription`, subFormData);
      showNotification(res.data?.message || "Biznes obunasi yangilandi!");
      setShowSubModal(false);
      await loadData();
    } catch (err: any) {
      showNotification(err.message || "Xatolik yuz berdi", true);
    } finally {
      setActionLoading(null);
    }
  };

  // Admin Actions
  const handleCreateAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminFormData.email || !adminFormData.password || !adminFormData.full_name) {
      alert("Iltimos, barcha majburiy maydonlarni to'ldiring!");
      return;
    }
    setActionLoading('admin_create');
    try {
      const res = await apiPost('/superadmin/admins', adminFormData);
      showNotification(res.data?.message || "Yangi SuperAdmin muvaffaqiyatli qo'shildi!");
      setShowAddAdminModal(false);
      setAdminFormData({ full_name: '', email: '', password: '', phone: '' });
      await loadData();
    } catch (err: any) {
      showNotification(err.message || "Xatolik yuz berdi", true);
    } finally {
      setActionLoading(null);
    }
  };

  const handleGrantAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!grantEmail.trim()) return;
    setActionLoading('admin_grant');
    try {
      const res = await apiPost('/superadmin/admins/grant', { email: grantEmail.trim() });
      showNotification(res.data?.message || "Foydalanuvchiga SuperAdmin vakolati berildi!");
      setGrantEmail('');
      await loadData();
    } catch (err: any) {
      showNotification(err.message || "Foydalanuvchi topilmadi yoki xatolik", true);
    } finally {
      setActionLoading(null);
    }
  };

  const handleRevokeAdmin = async (adminId: string, adminName: string) => {
    if (!confirm(`"${adminName}" foydalanuvchisidan SuperAdmin vakolatini bekor qilishni tasdiqlaysizmi?`)) return;
    setActionLoading(`revoke_${adminId}`);
    try {
      await apiDelete(`/superadmin/admins/${adminId}`);
      showNotification(`SuperAdmin huquqi olib tashlandi.`);
      await loadData();
    } catch (err: any) {
      showNotification(err.message || "Xatolik yuz berdi", true);
    } finally {
      setActionLoading(null);
    }
  };

  const pendingPaymentsCount = payments.filter(p => p.status === 'PENDING').length;

  const filteredBusinesses = businesses.filter(b => {
    const q = searchQuery.toLowerCase();
    return (
      (b.name || '').toLowerCase().includes(q) ||
      (b.slug || '').toLowerCase().includes(q) ||
      (b.phone || '').toLowerCase().includes(q)
    );
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-[#080b12] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#080b12] text-slate-100 p-4 sm:p-6 lg:p-8 space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800/80">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-purple-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-purple-600/30">
              <ShieldAlert className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-extrabold text-white flex items-center gap-2">
                Super Admin Platformasi
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30 font-bold">
                  SaaS Master
                </span>
              </h1>
              <p className="text-xs text-slate-400 mt-0.5">
                Barcha bizneslar, to&apos;lovlar tasdiqlash, obunalar nazorati va superadminlar boshqaruvi.
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={loadData}
            className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            title="Yangilash"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <Link
            href="/dashboard"
            className="px-4 py-2.5 rounded-xl bg-slate-800/90 hover:bg-slate-700 text-xs font-semibold text-slate-200 flex items-center gap-2 border border-slate-700 transition-all shadow-md"
          >
            <ArrowLeft className="w-4 h-4" /> Boshqaruv paneliga qaytish
          </Link>
        </div>
      </div>

      {/* Notifications */}
      {error && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center gap-2 animate-fade-in">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {success && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs flex items-center gap-2 animate-fade-in">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {/* Metrics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 sm:gap-4">
        <div className="p-4 sm:p-5 rounded-2xl bg-slate-900/70 border border-slate-800/80 shadow-lg">
          <span className="text-[11px] text-slate-400 block font-medium">Jami Bizneslar</span>
          <h3 className="text-xl sm:text-2xl font-black text-white mt-1">{metrics?.total_businesses || 0} ta</h3>
        </div>
        <div className="p-4 sm:p-5 rounded-2xl bg-slate-900/70 border border-slate-800/80 shadow-lg">
          <span className="text-[11px] text-slate-400 block font-medium">Kutilayotgan To&apos;lovlar</span>
          <h3 className="text-xl sm:text-2xl font-black text-amber-400 mt-1">{pendingPaymentsCount} ta</h3>
        </div>
        <div className="p-4 sm:p-5 rounded-2xl bg-slate-900/70 border border-slate-800/80 shadow-lg">
          <span className="text-[11px] text-slate-400 block font-medium">Ulangan Telegram Botlar</span>
          <h3 className="text-xl sm:text-2xl font-black text-cyan-400 mt-1">{metrics?.total_connected_bots || 0} ta</h3>
        </div>
        <div className="p-4 sm:p-5 rounded-2xl bg-slate-900/70 border border-slate-800/80 shadow-lg">
          <span className="text-[11px] text-slate-400 block font-medium">Jami SuperAdminlar</span>
          <h3 className="text-xl sm:text-2xl font-black text-purple-400 mt-1">{admins.length} ta</h3>
        </div>
        <div className="p-4 sm:p-5 rounded-2xl bg-slate-900/70 border border-slate-800/80 shadow-lg col-span-2 md:col-span-1">
          <span className="text-[11px] text-slate-400 block font-medium">Tizim Holati</span>
          <h3 className="text-base sm:text-lg font-bold text-emerald-400 mt-1.5 flex items-center gap-1.5">
            <Activity className="w-4 h-4 text-emerald-400" /> {metrics?.system_health || '100% Faol'}
          </h3>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-800 pb-3">
        <button
          onClick={() => setActiveTab('PAYMENTS')}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
            activeTab === 'PAYMENTS'
              ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30'
              : 'text-slate-400 hover:text-white bg-slate-900/60 hover:bg-slate-800'
          }`}
        >
          <CreditCard className="w-4 h-4" />
          <span>To&apos;lov So&apos;rovlari ({pendingPaymentsCount})</span>
        </button>
        <button
          onClick={() => setActiveTab('BUSINESSES')}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
            activeTab === 'BUSINESSES'
              ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30'
              : 'text-slate-400 hover:text-white bg-slate-900/60 hover:bg-slate-800'
          }`}
        >
          <Building2 className="w-4 h-4" />
          <span>Bizneslar & Obunalar ({businesses.length})</span>
        </button>
        <button
          onClick={() => setActiveTab('ADMINS')}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
            activeTab === 'ADMINS'
              ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30'
              : 'text-slate-400 hover:text-white bg-slate-900/60 hover:bg-slate-800'
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          <span>SuperAdminlar Boshqaruvi ({admins.length})</span>
        </button>
      </div>

      {/* TAB 1: PAYMENTS */}
      {activeTab === 'PAYMENTS' && (
        <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800/80 space-y-4 shadow-xl">
          <div className="flex justify-between items-center">
            <h3 className="font-bold text-white text-base flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-purple-400" /> Bank Kartasi Orqali Tushgan To&apos;lovlar
            </h3>
            <span className="text-xs text-slate-400">Jami: {payments.length} ta so&apos;rov</span>
          </div>

          {payments.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-sm">
              Hozircha to&apos;lov so&apos;rovlari mavjud emas.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="text-slate-400 uppercase bg-slate-950/80 border-b border-slate-800">
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

      {/* TAB 2: BUSINESSES & SUBSCRIPTIONS */}
      {activeTab === 'BUSINESSES' && (
        <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800/80 space-y-4 shadow-xl">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div>
              <h3 className="font-bold text-white text-base">Bizneslar & Obunalar Nazorati</h3>
              <p className="text-xs text-slate-400">Har bir biznesning tarifi, qolgan muddati, mahsulotlari va holati.</p>
            </div>
            {/* Search */}
            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                placeholder="Biznes nomi, slug yoki telefon..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-950/80 border border-slate-800 text-xs text-white focus:outline-none focus:border-purple-500"
              />
            </div>
          </div>

          {filteredBusinesses.length === 0 ? (
            <div className="text-center py-10 text-slate-400 text-xs">
              Hech qanday biznes topilmadi.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="text-slate-400 uppercase bg-slate-950/80 border-b border-slate-800">
                  <tr>
                    <th className="px-4 py-3">Biznes</th>
                    <th className="px-4 py-3">Tarif & Holati</th>
                    <th className="px-4 py-3">Qolgan Muddat</th>
                    <th className="px-4 py-3">Mahsulotlar</th>
                    <th className="px-4 py-3">Buyurtmalar</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-center">Boshqaruv</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                  {filteredBusinesses.map((b) => {
                    const sub = b.subscription || {};
                    const isExp = sub.status === 'EXPIRED';
                    return (
                      <tr key={b.id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="px-4 py-3">
                          <div className="font-bold text-white text-sm">{b.name}</div>
                          <div className="text-[11px] text-slate-500 font-mono">@{b.slug} • {b.phone || 'Tel yo‘q'}</div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="font-bold text-indigo-300 block">{sub.plan_name || 'Obunasiz'}</span>
                          <span className={`text-[10px] font-semibold ${
                            isExp ? 'text-red-400' : 'text-emerald-400'
                          }`}>
                            {isExp ? '⚠️ Muddati tugagan' : '✅ Faol obuna'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`font-mono text-xs font-bold ${
                            sub.days_left <= 3 ? 'text-red-400' : 'text-slate-200'
                          }`}>
                            {sub.days_left} kun
                          </span>
                        </td>
                        <td className="px-4 py-3 font-semibold text-slate-300">
                          {b.stats?.products_count || 0} ta
                        </td>
                        <td className="px-4 py-3 font-semibold text-slate-300">
                          {b.stats?.orders_count || 0} ta
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            b.is_active ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-red-500/20 text-red-300 border border-red-500/30'
                          }`}>
                            {b.is_active ? 'Faol' : 'Bloklangan'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => handleOpenSubModal(b)}
                              className="px-2.5 py-1.5 rounded-lg bg-indigo-600/30 hover:bg-indigo-600 text-indigo-200 hover:text-white border border-indigo-500/40 text-xs font-semibold transition-all flex items-center gap-1"
                            >
                              <Calendar className="w-3.5 h-3.5" /> Tarif berish
                            </button>
                            <button
                              onClick={() => handleToggleBusinessStatus(b.id, b.name)}
                              disabled={actionLoading === `biz_${b.id}`}
                              className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                                b.is_active
                                  ? 'bg-red-500/10 hover:bg-red-500/20 text-red-300 border-red-500/30'
                                  : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                              }`}
                            >
                              {b.is_active ? 'Bloklash' : 'Faollashtirish'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: SUPERADMINS MANAGEMENT */}
      {activeTab === 'ADMINS' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left: Create / Grant SuperAdmin Form */}
            <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800/80 space-y-5 shadow-xl">
              <div>
                <h3 className="font-bold text-white text-base flex items-center gap-2">
                  <UserPlus className="w-5 h-5 text-purple-400" /> Yangi SuperAdmin Qo&apos;shish
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Platformani birgalikda boshqarish uchun ishonchli superadmin qo&apos;shing.
                </p>
              </div>

              <form onSubmit={handleCreateAdmin} className="space-y-3">
                <div>
                  <label className="text-xs text-slate-300 font-semibold mb-1 block">To&apos;liq Ismi *</label>
                  <input
                    type="text"
                    required
                    placeholder="Masalan: Sardor Aliyev"
                    value={adminFormData.full_name}
                    onChange={(e) => setAdminFormData({ ...adminFormData, full_name: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950/80 border border-slate-800 text-xs text-white focus:outline-none focus:border-purple-500"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-300 font-semibold mb-1 block">Email Manzili *</label>
                  <input
                    type="email"
                    required
                    placeholder="admin@prosales.uz"
                    value={adminFormData.email}
                    onChange={(e) => setAdminFormData({ ...adminFormData, email: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950/80 border border-slate-800 text-xs text-white focus:outline-none focus:border-purple-500"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-300 font-semibold mb-1 block">Yangi Parol *</label>
                  <input
                    type="password"
                    required
                    placeholder="Eng kamida 6 ta belgi"
                    value={adminFormData.password}
                    onChange={(e) => setAdminFormData({ ...adminFormData, password: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950/80 border border-slate-800 text-xs text-white focus:outline-none focus:border-purple-500"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-300 font-semibold mb-1 block">Telefon (ixtiyoriy)</label>
                  <input
                    type="text"
                    placeholder="+998901234567"
                    value={adminFormData.phone}
                    onChange={(e) => setAdminFormData({ ...adminFormData, phone: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950/80 border border-slate-800 text-xs text-white focus:outline-none focus:border-purple-500"
                  />
                </div>
                <button
                  type="submit"
                  disabled={actionLoading === 'admin_create'}
                  className="w-full py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow-lg shadow-purple-600/30 transition-all flex items-center justify-center gap-2 disabled:opacity-50 mt-2"
                >
                  {actionLoading === 'admin_create' ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                  <span>SuperAdmin Yaratish</span>
                </button>
              </form>

              {/* Quick Grant by existing email */}
              <div className="pt-4 border-t border-slate-800/80">
                <span className="text-xs font-bold text-slate-300 block mb-1">Mavjud foydalanuvchiga SuperAdmin berish:</span>
                <form onSubmit={handleGrantAdmin} className="flex gap-2">
                  <input
                    type="email"
                    placeholder="Foydalanuvchi emaili..."
                    value={grantEmail}
                    onChange={(e) => setGrantEmail(e.target.value)}
                    className="flex-1 px-3 py-2 rounded-xl bg-slate-950/80 border border-slate-800 text-xs text-white focus:outline-none focus:border-purple-500"
                  />
                  <button
                    type="submit"
                    disabled={actionLoading === 'admin_grant' || !grantEmail.trim()}
                    className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-purple-300 text-xs font-semibold border border-purple-500/30 transition-all disabled:opacity-50"
                  >
                    Tayinlash
                  </button>
                </form>
              </div>
            </div>

            {/* Right: Admins List */}
            <div className="lg:col-span-2 p-6 rounded-2xl bg-slate-900/60 border border-slate-800/80 space-y-4 shadow-xl">
              <div>
                <h3 className="font-bold text-white text-base flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-emerald-400" /> Mavjud SuperAdminlar Ro&apos;yxati
                </h3>
                <p className="text-xs text-slate-400 mt-1">Platformaga to&apos;liq kirish va boshqaruv huquqiga ega adminlar.</p>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="text-slate-400 uppercase bg-slate-950/80 border-b border-slate-800">
                    <tr>
                      <th className="px-4 py-3">Admin</th>
                      <th className="px-4 py-3">Email</th>
                      <th className="px-4 py-3">Telefon</th>
                      <th className="px-4 py-3">Qo&apos;shilgan sana</th>
                      <th className="px-4 py-3 text-center">Amal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/50">
                    {admins.map((a) => (
                      <tr key={a.id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="px-4 py-3 font-bold text-white flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-purple-500 to-indigo-500 flex items-center justify-center text-[10px] font-bold text-white">
                            {a.full_name ? a.full_name[0].toUpperCase() : 'A'}
                          </div>
                          <span>{a.full_name}</span>
                        </td>
                        <td className="px-4 py-3 text-slate-300 font-mono">{a.email}</td>
                        <td className="px-4 py-3 text-slate-400">{a.phone || '-'}</td>
                        <td className="px-4 py-3 text-slate-500">{a.created_at}</td>
                        <td className="px-4 py-3 text-center">
                          <button
                            onClick={() => handleRevokeAdmin(a.id, a.full_name)}
                            disabled={actionLoading === `revoke_${a.id}`}
                            className="px-2.5 py-1 rounded-lg bg-red-500/10 hover:bg-red-500/25 text-red-400 text-[11px] font-semibold border border-red-500/30 transition-all disabled:opacity-50"
                          >
                            O&apos;chirish
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Subscription Management Modal for Businesses */}
      {showSubModal && selectedBusiness && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[#0c101c] border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-4 animate-fade-in">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <div>
                <h3 className="font-bold text-white text-base">Biznes Obunasini Yangilash</h3>
                <span className="text-xs text-purple-300">{selectedBusiness.name}</span>
              </div>
              <button onClick={() => setShowSubModal(false)} className="text-slate-400 hover:text-white p-1">
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-slate-300 font-semibold mb-1 block">Tarif Tanlash</label>
                <select
                  value={subFormData.plan_slug}
                  onChange={(e) => setSubFormData({ ...subFormData, plan_slug: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-white focus:outline-none focus:border-purple-500"
                >
                  <option value="free-trial">Free Trial (14 kunlik sinov)</option>
                  <option value="starter">Starter (Kichik biznes)</option>
                  <option value="pro">Pro (O&apos;rta va yirik)</option>
                  <option value="enterprise">Enterprise (Cheksiz VIP)</option>
                </select>
              </div>

              <div>
                <label className="text-slate-300 font-semibold mb-1 block">Qo&apos;shiladigan Kunlar Soni</label>
                <div className="grid grid-cols-4 gap-2">
                  {[14, 30, 90, 365].map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setSubFormData({ ...subFormData, extend_days: d })}
                      className={`py-2 rounded-xl font-bold border transition-all ${
                        subFormData.extend_days === d
                          ? 'bg-purple-600 text-white border-purple-500'
                          : 'bg-slate-900 text-slate-400 border-slate-800 hover:bg-slate-800'
                      }`}
                    >
                      +{d} kun
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex gap-2 pt-2 border-t border-slate-800">
              <button
                onClick={() => setShowSubModal(false)}
                className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs transition-colors"
              >
                Bekor qilish
              </button>
              <button
                onClick={handleSaveBusinessSub}
                disabled={actionLoading === 'sub_save'}
                className="flex-1 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow-lg shadow-purple-600/30 transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                {actionLoading === 'sub_save' ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                <span>Saqlash & Faollashtirish</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
