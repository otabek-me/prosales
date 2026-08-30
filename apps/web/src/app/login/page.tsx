'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Sparkles, ArrowRight, ShieldCheck, CheckCircle2, Loader2 } from 'lucide-react';
import { apiPost, setToken, setOrgId } from '@/lib/api';

export default function LoginPage() {
  const router = useRouter();
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isRegister) {
        const res = await apiPost('/auth/register', {
          email,
          password,
          full_name: fullName,
          phone: phone || undefined,
        });
        if (res.success && res.data) {
          setToken(res.data.tokens.access_token);
          if (res.data.organization_id) setOrgId(res.data.organization_id);
          router.push('/onboarding');
        }
      } else {
        const res = await apiPost('/auth/login', { email, password });
        if (res.success && res.data) {
          setToken(res.data.tokens.access_token);
          if (res.data.organization_id) setOrgId(res.data.organization_id);
          router.push('/dashboard');
        }
      }
    } catch (err: any) {
      setError(err.message || "Xatolik yuz berdi");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen app-shell bg-slate-950 flex flex-col justify-center items-center p-4 relative overflow-hidden">
      {/* Dynamic Background Glows */}
      <div className="absolute top-1/4 left-1/3 w-96 h-96 bg-indigo-600/20 rounded-full blur-3xl pointer-events-none animate-float"></div>
      <div className="absolute bottom-1/4 right-1/3 w-96 h-96 bg-purple-600/20 rounded-full blur-3xl pointer-events-none animate-float" style={{ animationDelay: '-3s' }}></div>

      <div className="w-full max-w-md gradient-border rounded-2xl shadow-2xl">
        <div className="glass-panel rounded-xl p-8 relative z-10">
        {/* Logo */}
        <div className="flex justify-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-indigo-600 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-600/30 animate-float">
            <Sparkles className="w-7 h-7 text-white" />
          </div>
        </div>

        <h1 className="text-2xl font-bold text-white text-center mb-1 font-display tracking-tight">
          {isRegister ? "Ro'yxatdan o'tish" : "Tizimga kirish"}
        </h1>
        <p className="text-sm text-slate-400 text-center mb-6">
          {isRegister ? "Yangi biznes hisobini yarating" : "AI Sales platformasiga xush kelibsiz"}
        </p>

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {isRegister && (
            <>
              <div>
                <label className="text-xs font-medium text-slate-300 mb-1 block">To'liq ism</label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-slate-800/50 border border-slate-700 text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 transition-colors text-sm"
                  placeholder="Bekzod Karimov"
                  required
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-300 mb-1 block">Telefon raqam</label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-slate-800/50 border border-slate-700 text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 transition-colors text-sm"
                  placeholder="+998 90 123 45 67"
                />
              </div>
            </>
          )}

          <div>
            <label className="text-xs font-medium text-slate-300 mb-1 block">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-slate-800/50 border border-slate-700 text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 transition-colors text-sm"
              placeholder="sizning@email.uz"
              required
            />
          </div>

          <div>
            <label className="text-xs font-medium text-slate-300 mb-1 block">Parol</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-slate-800/50 border border-slate-700 text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 transition-colors text-sm"
              placeholder="••••••••"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-semibold text-sm transition-all shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                {isRegister ? "Ro'yxatdan o'tish" : "Kirish"}
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button
            onClick={() => { setIsRegister(!isRegister); setError(''); }}
            className="text-sm text-indigo-400 hover:text-indigo-300 transition-colors"
          >
            {isRegister
              ? "Hisobingiz bormi? Kirish"
              : "Hisobingiz yo'qmi? Ro'yxatdan o'tish"}
          </button>
        </div>

        {/* Features */}
        <div className="mt-6 pt-6 border-t border-slate-800 space-y-2">
          {["AI avtomatik sotuvchi", "Telegram bot integratsiya", "24/7 mijozlar bilan muloqot"].map((f, i) => (
            <div key={i} className="flex items-center gap-2 text-xs text-slate-400">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              {f}
            </div>
          ))}
        </div>
      </div>
    </div>
    </div>
  );
}
