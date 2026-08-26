'use client';

import React, { useState, useEffect } from 'react';
import { CreditCard, Loader2, CheckCircle2, Zap, Star, Building2 } from 'lucide-react';
import { apiGet } from '@/lib/api';

export default function BillingPage() {
  const [plans, setPlans] = useState<any[]>([]);
  const [currentSub, setCurrentSub] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [plansRes, subRes] = await Promise.all([
        apiGet('/subscriptions/plans'),
        apiGet('/subscriptions/current'),
      ]);
      setPlans(plansRes.data || []);
      setCurrentSub(subRes.data || null);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const planIcons: Record<string, any> = {
    starter: Zap,
    business: Star,
    pro: Building2,
  };

  const planColors: Record<string, string> = {
    starter: 'from-blue-500 to-cyan-500',
    business: 'from-indigo-500 to-purple-500',
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
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <CreditCard className="w-5 h-5 text-indigo-400" /> Obuna va To&apos;lov
        </h2>
        <p className="text-xs text-slate-400 mt-1">Joriy obunangiz va mavjud tariflar.</p>
      </div>

      {/* Current Subscription */}
      {currentSub && (
        <div className="glass-panel p-5 rounded-2xl border border-indigo-500/30 flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-400">Joriy obuna</p>
            <p className="text-white font-semibold mt-0.5">{currentSub.plan?.name || 'Starter'}</p>
            <p className="text-xs text-slate-400 mt-1">
              Muddat: {currentSub.current_period_end
                ? new Date(currentSub.current_period_end).toLocaleDateString('uz')
                : '-'} gacha
            </p>
          </div>
          <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
            currentSub.status === 'TRIAL'
              ? 'bg-yellow-500/20 text-yellow-400'
              : currentSub.status === 'ACTIVE'
              ? 'bg-emerald-500/20 text-emerald-400'
              : 'bg-red-500/20 text-red-400'
          }`}>
            {currentSub.status === 'TRIAL' ? 'Sinov davri (Trial)' : currentSub.status}
          </span>
        </div>
      )}

      {/* Plans */}
      {plans.length === 0 ? (
        <div className="glass-panel p-10 rounded-2xl border border-slate-800 text-center">
          <CreditCard className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <p className="text-slate-400 text-sm">Tariflar yuklanmoqda...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {plans.map((plan) => {
            const slug = (plan.slug || '').toLowerCase();
            const Icon = planIcons[slug] || Zap;
            const gradient = planColors[slug] || 'from-indigo-500 to-purple-500';
            const isCurrent = currentSub?.plan?.id === plan.id || currentSub?.plan?.slug === plan.slug;
            const price = Number(plan.price_monthly ?? plan.price ?? 0);

            const featuresList = Array.isArray(plan.features)
              ? plan.features
              : Object.entries(plan.features || {}).map(([k, v]) => `${k}: ${v}`);

            return (
              <div
                key={plan.id || plan.slug}
                className={`glass-panel p-6 rounded-2xl border transition-all flex flex-col justify-between ${
                  isCurrent ? 'border-indigo-500/50 shadow-lg shadow-indigo-500/10' : 'border-slate-800 hover:border-slate-700'
                }`}
              >
                <div>
                  <div className={`w-10 h-10 rounded-xl bg-gradient-to-tr ${gradient} flex items-center justify-center mb-4`}>
                    <Icon className="w-5 h-5 text-white" />
                  </div>
                  <h3 className="text-white font-bold text-lg">{plan.name}</h3>
                  <p className="text-2xl font-bold text-white mt-2">
                    {price > 0 ? `${price.toLocaleString()} UZS` : 'Bepul'}
                    <span className="text-sm text-slate-400 font-normal"> /oy</span>
                  </p>

                  <div className="mt-4 space-y-2">
                    {featuresList.map((f: any, idx: number) => (
                      <div key={idx} className="flex items-center gap-2 text-xs text-slate-300">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                        <span>{f}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-6">
                  {isCurrent ? (
                    <div className="w-full py-2.5 rounded-xl bg-indigo-500/20 text-indigo-400 text-xs font-semibold text-center border border-indigo-500/30">
                      ✓ Joriy tarif
                    </div>
                  ) : (
                    <button className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition-all border border-slate-700">
                      Tarifni tanlash
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
