'use client';

import React, { useState, useEffect } from 'react';
import {
  ShieldAlert, Building2, Users, CreditCard, Activity, Bot, Loader2, ArrowLeft,
  UserPlus, CheckCircle2, XCircle, Clock, Search, RefreshCw, Sparkles, ShieldCheck,
  Calendar, Phone, Mail, UserCheck, AlertTriangle, Key, Plus, Trash2, Edit3,
  Eye, X, ExternalLink, DollarSign, Package, MessageSquare, AlertCircle, Check, Copy
} from 'lucide-react';
import Link from 'next/link';
import { apiGet, apiPost, apiPut, apiDelete } from '@/lib/api';

export default function SuperAdminDashboard() {
  const [metrics, setMetrics] = useState<any>(null);
  const [businesses, setBusinesses] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [admins, setAdmins] = useState<any[]>([]);
  const [plans, setPlans] = useState<any[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [activeTab, setActiveTab] = useState<'BUSINESSES' | 'PAYMENTS' | 'ADMINS'>('BUSINESSES');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'BLOCKED' | 'EXPIRED'>('ALL');

  // Modals state
  // 1. Details Modal
  const [viewingDetails, setViewingDetails] = useState<any | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);

  // 2. Reset Password Modal
  const [resetPwBusiness, setResetPwBusiness] = useState<any | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [generatedPwInfo, setGeneratedPwInfo] = useState<string | null>(null);

  // 3. Edit Business Modal
  const [editingBusiness, setEditingBusiness] = useState<any | null>(null);
  const [editFormData, setEditFormData] = useState({ name: '', phone: '', category: '' });

  // 4. Subscription Modal
  const [showSubModal, setShowSubModal] = useState(false);
  const [selectedBusiness, setSelectedBusiness] = useState<any>(null);
  const [subFormData, setSubFormData] = useState({
    plan_slug: 'starter',
    extend_days: 30
  });

  // 5. Add Admin Modal
  const [adminFormData, setAdminFormData] = useState({
    full_name: '',
    email: '',
    password: '',
    phone: ''
  });
  const [grantEmail, setGrantEmail] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const showNotification = (msg: string, isErr = false) => {
    if (isErr) {
      setError(msg);
      setTimeout(() => setError(''), 6000);
    } else {
      setSuccess(msg);
      setTimeout(() => setSuccess(''), 6000);
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

  // View Business Details
  const handleOpenDetails = async (bizId: string) => {
    setDetailsLoading(true);
    setViewingDetails(null);
    try {
      const res = await apiGet(`/superadmin/businesses/${bizId}/details`);
      setViewingDetails(res.data || {});
    } catch (err: any) {
      showNotification(err.message || "Ma'lumotlarni yuklashda xatolik", true);
    } finally {
      setDetailsLoading(false);
    }
  };

  // Reset Password Action
  const handleOpenResetPassword = (b: any) => {
    setResetPwBusiness(b);
    // Avtomatik ishonchli parol taklif qilish
    const autoGen = 'ProPass!' + Math.floor(100000 + Math.random() * 900000);
    setNewPassword(autoGen);
    setGeneratedPwInfo(null);
  };

  const handleSubmitResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetPwBusiness || !newPassword.trim()) return;
    setActionLoading('reset_pw');
    try {
      const res = await apiPost(`/superadmin/businesses/${resetPwBusiness.id}/reset-password`, {
        new_password: newPassword.trim()
      });
      showNotification(res.data?.message || "Parol muvaffaqiyatli tiklandi!");
      setGeneratedPwInfo(`Foydalanuvchi: ${resetPwBusiness.owner?.email || resetPwBusiness.name} | Yangi parol: ${newPassword}`);
    } catch (err: any) {
      showNotification(err.message || "Parolni yangilashda xatolik", true);
    } finally {
      setActionLoading(null);
    }
  };

  // Cancel Subscription
  const handleCancelSubscription = async (bizId: string, bizName: string) => {
    if (!confirm(`Haqiqatan ham "${bizName}" biznesining obunasini bekor qilmoqchimisiz? (Barcha avtomatizatsiya va xizmatlar to'xtatiladi)`)) {
      return;
    }
    setActionLoading(`cancel_${bizId}`);
    try {
      const res = await apiPost(`/superadmin/businesses/${bizId}/cancel-subscription`, {});
      showNotification(res.data?.message || "Obuna bekor qilindi.");
      await loadData();
      if (viewingDetails && viewingDetails.business?.id === bizId) {
        handleOpenDetails(bizId);
      }
    } catch (err: any) {
      showNotification(err.message || "Xatolik yuz berdi", true);
    } finally {
      setActionLoading(null);
    }
  };

  // Delete Business
  const handleDeleteBusiness = async (bizId: string, bizName: string) => {
    const prompt1 = confirm(`DIQQAT: "${bizName}" biznesini va unga tegishli barcha mahsulotlar, bot, mijozlar va buyurtmalarni butunlay o'chirmoqchimisiz?`);
    if (!prompt1) return;
    const prompt2 = prompt(`Tasdiqlash uchun biznes nomini yozing: "${bizName}"`);
    if (prompt2?.trim().toLowerCase() !== bizName.trim().toLowerCase()) {
      alert("Biznes nomi noto'g'ri kiritildi. O'chirish bekor qilindi.");
      return;
    }

    setActionLoading(`del_${bizId}`);
    try {
      const res = await apiDelete(`/superadmin/businesses/${bizId}`);
      showNotification(res.data?.message || "Biznes butunlay o'chirildi.");
      setViewingDetails(null);
      await loadData();
    } catch (err: any) {
      showNotification(err.message || "O'chirishda xatolik yuz berdi", true);
    } finally {
      setActionLoading(null);
    }
  };

  // Edit Business Info
  const handleOpenEdit = (b: any) => {
    setEditingBusiness(b);
    setEditFormData({
      name: b.name || '',
      phone: b.phone || '',
      category: b.category || ''
    });
  };

  const handleSaveEditBusiness = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBusiness) return;
    setActionLoading('edit_save');
    try {
      const res = await apiPut(`/superadmin/businesses/${editingBusiness.id}`, editFormData);
      showNotification(res.data?.message || "Biznes ma'lumotlari yangilandi!");
      setEditingBusiness(null);
      await loadData();
    } catch (err: any) {
      showNotification(err.message || "Xatolik yuz berdi", true);
    } finally {
      setActionLoading(null);
    }
  };

  // Toggle Business Status
  const handleToggleBusinessStatus = async (orgId: string, currentName: string) => {
    setActionLoading(`biz_${orgId}`);
    try {
      const res = await apiPost(`/superadmin/businesses/${orgId}/toggle-status`, {});
      showNotification(res.data?.message || `"${currentName}" holati o'zgartirildi.`);
      await loadData();
      if (viewingDetails && viewingDetails.business?.id === orgId) {
        handleOpenDetails(orgId);
      }
    } catch (err: any) {
      showNotification(err.message || "Xatolik yuz berdi", true);
    } finally {
      setActionLoading(null);
    }
  };

  // Open Subscription Modal
  const handleOpenSubModal = (b: any) => {
    setSelectedBusiness(b);
    setSubFormData({
      plan_slug: b.subscription?.plan_slug || 'starter',
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
      if (viewingDetails && viewingDetails.business?.id === selectedBusiness.id) {
        handleOpenDetails(selectedBusiness.id);
      }
    } catch (err: any) {
      showNotification(err.message || "Xatolik yuz berdi", true);
    } finally {
      setActionLoading(null);
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
    const matchesQuery = (
      (b.name || '').toLowerCase().includes(q) ||
      (b.slug || '').toLowerCase().includes(q) ||
      (b.phone || '').toLowerCase().includes(q) ||
      (b.owner?.full_name || '').toLowerCase().includes(q) ||
      (b.owner?.email || '').toLowerCase().includes(q) ||
      (b.bot?.username || '').toLowerCase().includes(q)
    );

    if (!matchesQuery) return false;

    if (statusFilter === 'ACTIVE') return b.is_active && b.subscription?.status !== 'EXPIRED';
    if (statusFilter === 'BLOCKED') return !b.is_active;
    if (statusFilter === 'EXPIRED') return b.subscription?.status === 'EXPIRED';

    return true;
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
          <span className="text-[11px] text-slate-400 block font-medium">Jami Bizneslar (Tenants)</span>
          <h3 className="text-xl sm:text-2xl font-black text-white mt-1">{metrics?.total_businesses || businesses.length || 0} ta</h3>
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

      {/* TAB 1: BUSINESSES & SUBSCRIPTIONS */}
      {activeTab === 'BUSINESSES' && (
        <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800/80 space-y-4 shadow-xl">
          {/* Controls row */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h3 className="font-bold text-white text-base">Barcha Bizneslar (Do&apos;konlar)</h3>
              <p className="text-xs text-slate-400">Har bir biznesning tarifi, egasi, boti, qolgan muddati va to&apos;liq boshqaruvi.</p>
            </div>

            <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
              {/* Filter buttons */}
              <div className="flex items-center p-1 bg-slate-950/80 rounded-xl border border-slate-800 text-xs">
                {(['ALL', 'ACTIVE', 'EXPIRED', 'BLOCKED'] as const).map((st) => (
                  <button
                    key={st}
                    onClick={() => setStatusFilter(st)}
                    className={`px-2.5 py-1 rounded-lg font-semibold transition-all ${
                      statusFilter === st
                        ? 'bg-purple-600 text-white'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {st === 'ALL' ? 'Barchasi' : st === 'ACTIVE' ? 'Faollar' : st === 'EXPIRED' ? 'Muddati tugagan' : 'Bloklangan'}
                  </button>
                ))}
              </div>

              {/* Search input */}
              <div className="relative flex-1 md:w-64">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="text"
                  placeholder="Nomi, egasi, email, bot..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-950/80 border border-slate-800 text-xs text-white focus:outline-none focus:border-purple-500"
                />
              </div>
            </div>
          </div>

          {filteredBusinesses.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-xs">
              Hech qanday biznes topilmadi.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="text-slate-400 uppercase bg-slate-950/80 border-b border-slate-800">
                  <tr>
                    <th className="px-4 py-3">Biznes & Egasi</th>
                    <th className="px-4 py-3">Telegram Bot</th>
                    <th className="px-4 py-3">Tarif & Holat</th>
                    <th className="px-4 py-3">Qolgan Muddat</th>
                    <th className="px-4 py-3">Statistika</th>
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
                          <div className="font-bold text-white text-sm flex items-center gap-1.5">
                            <span>{b.name}</span>
                            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">@{b.slug}</span>
                          </div>
                          <div className="text-[11px] text-slate-400 mt-0.5">
                            Egasi: <span className="text-slate-200 font-medium">{b.owner?.full_name || 'Noma‘lum'}</span> ({b.owner?.email || b.phone || '-'})
                          </div>
                        </td>

                        <td className="px-4 py-3">
                          {b.bot?.username ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 flex items-center gap-1 w-fit">
                              <Bot className="w-3 h-3" /> @{b.bot.username}
                            </span>
                          ) : (
                            <span className="text-slate-500 text-[11px]">Ulanmagan</span>
                          )}
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

                        <td className="px-4 py-3">
                          <div className="text-slate-300 text-[11px]">
                            Tovarlar: <b>{b.stats?.products_count || 0} ta</b>
                          </div>
                          <div className="text-slate-400 text-[10px]">
                            Buyurtmalar: <b>{b.stats?.orders_count || 0} ta</b>
                          </div>
                        </td>

                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            b.is_active ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-red-500/20 text-red-300 border border-red-500/30'
                          }`}>
                            {b.is_active ? 'Faol' : 'Bloklangan'}
                          </span>
                        </td>

                        <td className="px-4 py-3">
                          <div className="flex items-center justify-center gap-1.5 flex-wrap">
                            {/* Batafsil ko'rish */}
                            <button
                              onClick={() => handleOpenDetails(b.id)}
                              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-all"
                              title="To'liq ma'lumotlarni ko'rish"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>

                            {/* Tarif berish */}
                            <button
                              onClick={() => handleOpenSubModal(b)}
                              className="px-2 py-1 rounded-lg bg-indigo-600/25 hover:bg-indigo-600 text-indigo-200 hover:text-white border border-indigo-500/30 text-[11px] font-semibold transition-all flex items-center gap-1"
                              title="Tarifni boshqarish va muddat qo'shish"
                            >
                              <Calendar className="w-3 h-3" /> Tarif
                            </button>

                            {/* Parolni tiklash */}
                            <button
                              onClick={() => handleOpenResetPassword(b)}
                              className="p-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 transition-all"
                              title="Egasining parolini tiklab berish"
                            >
                              <Key className="w-3.5 h-3.5" />
                            </button>

                            {/* Bloklash / Faollashtirish */}
                            <button
                              onClick={() => handleToggleBusinessStatus(b.id, b.name)}
                              disabled={actionLoading === `biz_${b.id}`}
                              className={`px-2 py-1 rounded-lg text-[11px] font-semibold border transition-all ${
                                b.is_active
                                  ? 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border-amber-500/30'
                                  : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                              }`}
                            >
                              {b.is_active ? 'Blok' : 'Faol'}
                            </button>

                            {/* O'chirish */}
                            <button
                              onClick={() => handleDeleteBusiness(b.id, b.name)}
                              disabled={actionLoading === `del_${b.id}`}
                              className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/25 text-red-400 border border-red-500/30 transition-all"
                              title="Biznesni butunlay o'chirib yuborish"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
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

      {/* TAB 2: PAYMENTS */}
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

      {/* MODAL 1: BROWSE BUSINESS DETAILS (To'liq barcha ma'lumotlar oynasi) */}
      {viewingDetails && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-3xl max-h-[90vh] overflow-y-auto bg-[#0c101c] border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-6 animate-fade-in">
            {/* Header */}
            <div className="flex justify-between items-start border-b border-slate-800 pb-4">
              <div>
                <div className="flex items-center gap-2.5">
                  <h3 className="text-xl font-bold text-white">{viewingDetails.business?.name}</h3>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    viewingDetails.business?.is_active ? 'bg-emerald-500/20 text-emerald-300' : 'bg-red-500/20 text-red-300'
                  }`}>
                    {viewingDetails.business?.is_active ? 'Faol' : 'Bloklangan'}
                  </span>
                </div>
                <p className="text-xs text-slate-400 font-mono mt-0.5">
                  ID: {viewingDetails.business?.id} • Slug: @{viewingDetails.business?.slug} • Qo&apos;shilgan: {viewingDetails.business?.created_at}
                </p>
              </div>
              <button onClick={() => setViewingDetails(null)} className="text-slate-400 hover:text-white p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Quick Actions Bar inside Modal */}
            <div className="flex flex-wrap gap-2 p-3 rounded-xl bg-slate-950/80 border border-slate-800 text-xs">
              <button
                onClick={() => {
                  setViewingDetails(null);
                  handleOpenSubModal(viewingDetails.business);
                }}
                className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold transition-all flex items-center gap-1.5"
              >
                <Calendar className="w-3.5 h-3.5" /> Tarif berish (+kun)
              </button>
              <button
                onClick={() => {
                  setViewingDetails(null);
                  handleOpenResetPassword(viewingDetails.business);
                }}
                className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-semibold transition-all flex items-center gap-1.5"
              >
                <Key className="w-3.5 h-3.5" /> Parolni tiklash
              </button>
              <button
                onClick={() => handleCancelSubscription(viewingDetails.business?.id, viewingDetails.business?.name)}
                className="px-3 py-1.5 rounded-lg bg-red-600/30 hover:bg-red-600 text-red-300 hover:text-white border border-red-500/40 font-semibold transition-all flex items-center gap-1.5"
              >
                <XCircle className="w-3.5 h-3.5" /> Obunani bekor qilish
              </button>
              <button
                onClick={() => handleToggleBusinessStatus(viewingDetails.business?.id, viewingDetails.business?.name)}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold transition-all"
              >
                {viewingDetails.business?.is_active ? 'Biznesni bloklash' : 'Faollashtirish'}
              </button>
            </div>

            {/* Grid 4 Overview Blocks */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              {/* Block 1: Egasi (Owner) */}
              <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2">
                <span className="text-[11px] font-bold uppercase text-purple-400 flex items-center gap-1.5">
                  <UserCheck className="w-4 h-4" /> Biznes Egasi (Owner)
                </span>
                <div className="space-y-1 text-slate-300">
                  <div>Ismi: <b className="text-white">{viewingDetails.owner?.full_name || 'Noma‘lum'}</b></div>
                  <div>Email: <span className="font-mono text-indigo-300">{viewingDetails.owner?.email || '-'}</span></div>
                  <div>Telefon: <span>{viewingDetails.owner?.phone || viewingDetails.business?.phone || '-'}</span></div>
                </div>
              </div>

              {/* Block 2: Obuna & Tarif */}
              <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2">
                <span className="text-[11px] font-bold uppercase text-indigo-400 flex items-center gap-1.5">
                  <CreditCard className="w-4 h-4" /> Obuna & Tarif
                </span>
                <div className="space-y-1 text-slate-300">
                  <div>Tarif: <b className="text-white">{viewingDetails.subscription?.plan_name}</b> ({Number(viewingDetails.subscription?.price_monthly || 0).toLocaleString()} UZS/oy)</div>
                  <div>Status: <span className="font-bold text-emerald-400">{viewingDetails.subscription?.status}</span></div>
                  <div>Qolgan muddat: <b className="text-amber-400">{viewingDetails.subscription?.days_left} kun</b> (Tugash sanasi: {viewingDetails.subscription?.period_end || '-'})</div>
                </div>
              </div>

              {/* Block 3: Telegram Bot */}
              <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2">
                <span className="text-[11px] font-bold uppercase text-cyan-400 flex items-center gap-1.5">
                  <Bot className="w-4 h-4" /> Telegram Bot
                </span>
                <div className="space-y-1 text-slate-300">
                  <div>Bot: <b className="text-white">@{viewingDetails.bot?.bot_username || 'Ulanmagan'}</b></div>
                  <div>Status: <span className="text-cyan-300 font-semibold">{viewingDetails.bot?.status}</span></div>
                  <div>Webhook URL: <span className="font-mono text-[10px] text-slate-400 truncate block">{viewingDetails.bot?.webhook_url || '-'}</span></div>
                </div>
              </div>

              {/* Block 4: Statistika */}
              <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2">
                <span className="text-[11px] font-bold uppercase text-emerald-400 flex items-center gap-1.5">
                  <Activity className="w-4 h-4" /> Savdo Statistikasi
                </span>
                <div className="grid grid-cols-2 gap-2 text-slate-300">
                  <div>Tovarlar: <b className="text-white">{viewingDetails.stats?.total_products} ta</b></div>
                  <div>Mijozlar: <b className="text-white">{viewingDetails.stats?.total_customers} ta</b></div>
                  <div>Buyurtmalar: <b className="text-white">{viewingDetails.stats?.total_orders} ta</b></div>
                  <div>Jami aylanma: <b className="text-emerald-400">{Number(viewingDetails.stats?.total_revenue || 0).toLocaleString()} UZS</b></div>
                </div>
              </div>
            </div>

            {/* AI Settings Info */}
            {viewingDetails.ai_settings && (
              <div className="p-4 rounded-xl bg-slate-900/40 border border-slate-800 text-xs space-y-1.5">
                <span className="font-bold text-white flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-purple-400" /> AI Sotuvchi Sozlamalari
                </span>
                <div className="text-slate-300">Bot Nomi: <b>{viewingDetails.ai_settings?.bot_name}</b> | Model: <span className="font-mono text-purple-300">{viewingDetails.ai_settings?.model}</span></div>
                <div className="text-slate-400">Xarakteri: {viewingDetails.ai_settings?.personality}</div>
              </div>
            )}

            {/* Recent Orders List */}
            <div>
              <h4 className="text-xs font-bold text-white uppercase mb-2">So&apos;nggi Buyurtmalar</h4>
              {viewingDetails.recent_orders?.length === 0 ? (
                <div className="text-xs text-slate-500 py-3 text-center">Hali buyurtmalar mavjud emas</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-950 text-slate-400 border-b border-slate-800">
                      <tr>
                        <th className="p-2">Raqami</th>
                        <th className="p-2">Mijoz</th>
                        <th className="p-2">Summa</th>
                        <th className="p-2">Holati</th>
                        <th className="p-2">Sana</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/40">
                      {viewingDetails.recent_orders?.map((ord: any) => (
                        <tr key={ord.id}>
                          <td className="p-2 font-mono font-bold text-indigo-300">{ord.order_number}</td>
                          <td className="p-2 text-slate-200">{ord.customer_name}</td>
                          <td className="p-2 text-emerald-400 font-bold">{Number(ord.total_amount || 0).toLocaleString()} UZS</td>
                          <td className="p-2 text-slate-300">{ord.status}</td>
                          <td className="p-2 text-slate-500">{ord.created_at}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: RESET PASSWORD */}
      {resetPwBusiness && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[#0c101c] border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-4 animate-fade-in">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <div>
                <h3 className="font-bold text-white text-base flex items-center gap-2">
                  <Key className="w-4 h-4 text-amber-400" /> Parolni Tiklash
                </h3>
                <span className="text-xs text-slate-400">{resetPwBusiness.name} (Egasi: {resetPwBusiness.owner?.email || 'Owner'})</span>
              </div>
              <button onClick={() => setResetPwBusiness(null)} className="text-slate-400 hover:text-white p-1">
                <X className="w-4 h-4" />
              </button>
            </div>

            {generatedPwInfo ? (
              <div className="space-y-3">
                <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs space-y-2">
                  <div className="font-bold flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4" /> Yangi Parol O&apos;rnatildi!
                  </div>
                  <div className="p-2 bg-slate-950 rounded-lg font-mono text-white text-sm select-all">
                    {newPassword}
                  </div>
                  <p className="text-[11px] text-slate-400">Ushbu parolni nusxalab biznes egasiga taqdim eting.</p>
                </div>
                <button
                  onClick={() => setResetPwBusiness(null)}
                  className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs"
                >
                  Yopish
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmitResetPassword} className="space-y-4 text-xs">
                <div>
                  <label className="text-slate-300 font-semibold mb-1 block">Yangi Parol Belgilang *</label>
                  <input
                    type="text"
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-white font-mono text-sm focus:outline-none focus:border-amber-500"
                  />
                  <span className="text-[11px] text-slate-400 mt-1 block">Tizim avtomatik xavfsiz parol taklif qildi. Xohlasangiz o&apos;zgartiring.</span>
                </div>

                <div className="flex gap-2 pt-2 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setResetPwBusiness(null)}
                    className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs transition-colors"
                  >
                    Bekor qilish
                  </button>
                  <button
                    type="submit"
                    disabled={actionLoading === 'reset_pw'}
                    className="flex-1 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs shadow-lg shadow-amber-600/30 transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
                  >
                    {actionLoading === 'reset_pw' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Key className="w-4 h-4" />}
                    <span>Parolni Saqlash</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* MODAL 3: SUBSCRIPTION MANAGEMENT FOR BUSINESS */}
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
