'use client';

import React, { useState, useEffect } from 'react';
import { CreditCard, Loader2, CheckCircle2, Zap, Star, Building2, Copy, Check, AlertCircle, Clock, ShieldCheck, ArrowRight, Package, MessageSquare } from 'lucide-react';
import { apiGet, apiPost } from '@/lib/api';

export default function BillingPage() {
  const [plans, setPlans] = useState<any[]>([]);
  const [currentSub, setCurrentSub] = useState<any>(null);
  const [paymentInfo, setPaymentInfo] = useState<any>(null);
  const [myPayments, setMyPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Payment Modal State
  const [selectedPlan, setSelectedPlan] = useState<any>(null);
  const [senderName, setSenderName] = useState('');
  const [senderPhone, setSenderPhone] = useState('');
  const [transactionId, setTransactionId] = useState('');
  const [receiptNote, setReceiptNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [plansRes, subRes, payInfoRes, myPaysRes] = await Promise.all([
        apiGet('/subscriptions/plans'),
        apiGet('/subscriptions/current'),
        apiGet('/subscriptions/payment-info'),
        apiGet('/subscriptions/my-payments'),
      ]);
      setPlans(plansRes.data || []);
      setCurrentSub(subRes.data || null);
      setPaymentInfo(payInfoRes.data || null);
      setMyPayments(myPaysRes.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const copyCard = () => {
    if (!paymentInfo?.card_number) return;
    navigator.clipboard.writeText(paymentInfo.card_number.replace(/\s+/g, ''));
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handlePaySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPlan || !senderName.trim()) return;

    setSubmitting(true);
    setErrorMsg('');
    try {
      const res = await apiPost('/subscriptions/pay', {
        plan_id: selectedPlan.id,
        sender_name: senderName.trim(),
        sender_phone: senderPhone.trim() || undefined,
        transaction_id: transactionId.trim() || undefined,
        notes: receiptNote.trim() || undefined
      });

      setSuccessMsg(res.data?.message || "To'lov so'rovi qabul qilindi!");
      setSelectedPlan(null);
      setSenderName('');
      setSenderPhone('');
      setTransactionId('');
      setReceiptNote('');

      // Reload payments
      const myPaysRes = await apiGet('/subscriptions/my-payments');
      setMyPayments(myPaysRes.data || []);
      setTimeout(() => setSuccessMsg(''), 5000);
    } catch (err: any) {
      setErrorMsg(err.message || "To'lov yuborishda xatolik yuz berdi");
    } finally {
      setSubmitting(false);
    }
  };

  const planIcons: Record<string, any> = {
    'free-trial': Zap,
    starter: Star,
    business: Building2,
    pro: ShieldCheck,
  };

  const planGradients: Record<string, string> = {
    'free-trial': 'from-blue-500 to-cyan-500',
    starter: 'from-indigo-500 to-purple-500',
    business: 'from-purple-500 to-pink-500',
    pro: 'from-amber-500 to-orange-500',
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-6xl">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <CreditCard className="w-5 h-5 text-indigo-400" /> Obuna va Tariflar Boshqaruvi
        </h2>
        <p className="text-xs text-slate-400 mt-1">Platforma xizmatlaridan to&apos;liq va cheklovlarsiz foydalanish uchun tarifni tanlang.</p>
      </div>

      {successMsg && (
        <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-sm flex items-center gap-2 shadow-lg">
          <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm flex items-center gap-2 shadow-lg">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Current Subscription Card & Limits Usage */}
      {currentSub && (
        <div className="glass-panel p-6 rounded-2xl border border-indigo-500/30 shadow-xl bg-gradient-to-r from-indigo-950/40 via-slate-900 to-slate-900">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-800 pb-5">
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Joriy tarifingiz</span>
              <div className="flex items-center gap-3 mt-1">
                <h3 className="text-2xl font-bold text-white">{currentSub.plan?.name || 'Starter'}</h3>
                <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                  currentSub.status === 'TRIAL'
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                    : currentSub.status === 'ACTIVE'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    : 'bg-red-500/20 text-red-300 border border-red-500/30'
                }`}>
                  {currentSub.status === 'TRIAL' ? '🎁 Sinov davri (Free Trial)' : currentSub.status === 'ACTIVE' ? '✅ Faol obuna' : 'Muddati tugagan'}
                </span>
              </div>
            </div>

            <div className="text-left md:text-right">
              <span className="text-xs text-slate-400">Amal qilish muddati</span>
              <p className="text-sm font-semibold text-slate-200 mt-0.5">
                {currentSub.current_period_end ? new Date(currentSub.current_period_end).toLocaleDateString('uz', { dateStyle: 'long' }) : '-'}
              </p>
              <span className="text-xs font-semibold text-indigo-400">
                {currentSub.days_left > 0 ? `${currentSub.days_left} kun qoldi` : "Muddat tugadi"}
              </span>
            </div>
          </div>

          {/* Limits Progress */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-5">
            <div className="p-4 bg-slate-900/60 rounded-xl border border-slate-800">
              <div className="flex justify-between text-xs mb-1.5">
                <span className="text-slate-400 flex items-center gap-1.5">
                  <Package className="w-3.5 h-3.5 text-indigo-400" /> Mahsulotlar limiti
                </span>
                <span className="text-white font-bold">
                  {currentSub.usage?.products_count || 0} / {currentSub.usage?.products_limit || 5} ta
                </span>
              </div>
              <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full"
                  style={{
                    width: `${Math.min(100, ((currentSub.usage?.products_count || 0) / (currentSub.usage?.products_limit || 5)) * 100)}%`
                  }}
                />
              </div>
            </div>

            <div className="p-4 bg-slate-900/60 rounded-xl border border-slate-800">
              <div className="flex justify-between text-xs mb-1.5">
                <span className="text-slate-400 flex items-center gap-1.5">
                  <MessageSquare className="w-3.5 h-3.5 text-cyan-400" /> Suhbatlar / Mijozlar
                </span>
                <span className="text-white font-bold">
                  {currentSub.usage?.conversations_count || 0} / {currentSub.usage?.conversations_limit || 50} ta
                </span>
              </div>
              <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 rounded-full"
                  style={{
                    width: `${Math.min(100, ((currentSub.usage?.conversations_count || 0) / (currentSub.usage?.conversations_limit || 50)) * 100)}%`
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Plans Grid */}
      <div>
        <h3 className="text-lg font-bold text-white mb-4">Barcha Tarif Rejalari</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {plans.map((plan) => {
            const slug = (plan.slug || '').toLowerCase();
            const Icon = planIcons[slug] || Zap;
            const gradient = planGradients[slug] || 'from-indigo-500 to-purple-500';
            const isCurrent = currentSub?.plan?.id === plan.id || currentSub?.plan?.slug === plan.slug;
            const price = Number(plan.price_monthly ?? plan.price ?? 0);

            const featuresList = Array.isArray(plan.features)
              ? plan.features
              : Object.entries(plan.features || {}).map(([k, v]) => `${k}: ${v}`);

            return (
              <div
                key={plan.id || plan.slug}
                className={`glass-panel p-6 rounded-2xl border transition-all flex flex-col justify-between relative ${
                  isCurrent
                    ? 'border-indigo-500 shadow-xl shadow-indigo-500/10 ring-1 ring-indigo-500'
                    : 'border-slate-800 hover:border-slate-700'
                }`}
              >
                {slug === 'business' && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 text-white text-[10px] font-bold tracking-wider uppercase shadow-md">
                    Tavsiya etiladi
                  </span>
                )}

                <div>
                  <div className={`w-10 h-10 rounded-xl bg-gradient-to-tr ${gradient} flex items-center justify-center mb-4 shadow-md`}>
                    <Icon className="w-5 h-5 text-white" />
                  </div>
                  <h4 className="text-white font-bold text-lg">{plan.name}</h4>
                  <div className="mt-2 mb-4">
                    <span className="text-2xl font-extrabold text-white">
                      {price > 0 ? `${price.toLocaleString()} UZS` : '0 UZS'}
                    </span>
                    <span className="text-xs text-slate-400 font-normal"> /oy</span>
                  </div>

                  <div className="space-y-2.5 pt-2 border-t border-slate-800/80">
                    {featuresList.map((f: any, idx: number) => (
                      <div key={idx} className="flex items-start gap-2 text-xs text-slate-300">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0 mt-0.5" />
                        <span>{f}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-slate-800">
                  {isCurrent ? (
                    <div className="w-full py-2.5 rounded-xl bg-indigo-500/20 text-indigo-300 text-xs font-bold text-center border border-indigo-500/30">
                      ✓ Joriy faol tarif
                    </div>
                  ) : price === 0 ? (
                    <div className="w-full py-2.5 rounded-xl bg-slate-800/40 text-slate-400 text-xs font-medium text-center border border-slate-800">
                      Sinov tarifi
                    </div>
                  ) : (
                    <button
                      onClick={() => setSelectedPlan(plan)}
                      className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all shadow-md shadow-indigo-600/30 flex items-center justify-center gap-1.5"
                    >
                      <span>Obuna bo&apos;lish</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Payment History */}
      {myPayments.length > 0 && (
        <div className="glass-panel rounded-2xl border border-slate-800 overflow-hidden shadow-xl">
          <div className="p-4 border-b border-slate-800 bg-slate-900/40">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Clock className="w-4 h-4 text-indigo-400" /> To&apos;lov so&apos;rovlari tarixi
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-slate-400 bg-slate-900/60 border-b border-slate-800">
                  <th className="p-3.5">Tarif</th>
                  <th className="p-3.5">Summa</th>
                  <th className="p-3.5">To&apos;lovchi</th>
                  <th className="p-3.5">Status</th>
                  <th className="p-3.5">Sana</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {myPayments.map((pay) => (
                  <tr key={pay.id} className="hover:bg-slate-800/30">
                    <td className="p-3.5 font-semibold text-white">{pay.plan_name}</td>
                    <td className="p-3.5 font-bold text-emerald-400">{Number(pay.amount || 0).toLocaleString()} UZS</td>
                    <td className="p-3.5 text-slate-300">{pay.sender_name}</td>
                    <td className="p-3.5">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                        pay.status === 'APPROVED'
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          : pay.status === 'REJECTED'
                          ? 'bg-red-500/20 text-red-300 border border-red-500/30'
                          : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                      }`}>
                        {pay.status === 'APPROVED' ? 'Tasdiqlangan' : pay.status === 'REJECTED' ? 'Rad etilgan' : 'Kutilmoqda (Admin ko\'rmoqda)'}
                      </span>
                    </td>
                    <td className="p-3.5 text-slate-400">{pay.created_at}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Bank Card Payment Modal */}
      {selectedPlan && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-lg glass-panel rounded-2xl p-6 border border-indigo-500/40 shadow-2xl space-y-5">
            <div className="flex justify-between items-start border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-lg font-bold text-white">To&apos;lov va Obunani Faollashtirish</h3>
                <p className="text-xs text-indigo-400 font-semibold mt-0.5">
                  Tarif: {selectedPlan.name} ({Number(selectedPlan.price_monthly || 0).toLocaleString()} UZS / oy)
                </p>
              </div>
              <button
                onClick={() => setSelectedPlan(null)}
                className="text-slate-400 hover:text-white text-sm"
              >
                ✕
              </button>
            </div>

            {/* Bank Card Details Box */}
            <div className="p-4 rounded-xl bg-gradient-to-tr from-indigo-900/60 to-purple-900/60 border border-indigo-500/40 shadow-inner space-y-3">
              <div className="flex justify-between items-center text-xs text-indigo-300">
                <span>Bank: <b>{paymentInfo?.bank_name || 'Humo / Uzcard'}</b></span>
                <span>Summa: <b>{Number(selectedPlan.price_monthly || 0).toLocaleString()} UZS</b></span>
              </div>

              <div>
                <span className="text-[11px] text-slate-300 block mb-1">Karta raqami:</span>
                <div className="flex items-center justify-between p-3 rounded-lg bg-black/40 border border-indigo-500/30">
                  <span className="text-base sm:text-lg font-mono font-bold text-white tracking-widest">
                    {paymentInfo?.card_number || '9860 3501 2345 6789'}
                  </span>
                  <button
                    type="button"
                    onClick={copyCard}
                    className="p-1.5 rounded-md bg-indigo-600 hover:bg-indigo-500 text-white text-xs flex items-center gap-1 transition-colors"
                  >
                    {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copied ? 'Nusxalandi' : 'Nusxa'}</span>
                  </button>
                </div>
              </div>

              <div className="flex justify-between text-xs text-slate-300">
                <span>Karta egasi:</span>
                <span className="font-semibold text-white">{paymentInfo?.card_holder || 'OTABEK R.'}</span>
              </div>
            </div>

            {/* Payment Submit Form */}
            <form onSubmit={handlePaySubmit} className="space-y-3 text-xs">
              <div>
                <label className="text-slate-300 font-semibold mb-1 block">To&apos;lovchi Ismi va Familiyasi *</label>
                <input
                  required
                  value={senderName}
                  onChange={(e) => setSenderName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800/60 border border-slate-700 text-white focus:outline-none focus:border-indigo-500"
                  placeholder="Masalan: Otabek Rahmiddinov"
                />
              </div>

              <div>
                <label className="text-slate-300 font-semibold mb-1 block">Telefon raqamingiz</label>
                <input
                  value={senderPhone}
                  onChange={(e) => setSenderPhone(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800/60 border border-slate-700 text-white focus:outline-none focus:border-indigo-500"
                  placeholder="+998 90 123 45 67"
                />
              </div>

              <div>
                <label className="text-slate-300 font-semibold mb-1 block">Tranzaksiya kodi yoki Chek izohi</label>
                <input
                  value={transactionId}
                  onChange={(e) => setTransactionId(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800/60 border border-slate-700 text-white focus:outline-none focus:border-indigo-500"
                  placeholder="Payme/Click chek raqami yoki xabar"
                />
              </div>

              <div className="pt-2 flex gap-3">
                <button
                  type="submit"
                  disabled={submitting || !senderName.trim()}
                  className="flex-1 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/30 disabled:opacity-50"
                >
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                  To&apos;lovni tasdiqlash uchun yuborish
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedPlan(null)}
                  className="px-4 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs"
                >
                  Bekor qilish
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

