'use client';

import React, { useState, useEffect } from 'react';
import { Settings, Sparkles, Truck, CreditCard, Loader2, CheckCircle2, AlertCircle, Save, User } from 'lucide-react';
import { apiGet, apiPut } from '@/lib/api';

export default function AISettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  const [form, setForm] = useState({
    bot_name: '',
    personality: '',
    welcome_message: '',
    delivery_terms: '',
    payment_terms: '',
    language: 'uz',
    auto_order: false,
  });

  const [profileForm, setProfileForm] = useState({ full_name: '', email: '', phone: '' });
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState('');
  const [profileError, setProfileError] = useState('');

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const res = await apiGet('/auth/me');
      const u = res.data?.user || res.data;
      if (u) setProfileForm({ full_name: u.full_name || '', email: u.email || '', phone: u.phone || '' });
    } catch (err) { console.error(err); }
  };

  const handleProfileSave = async () => {
    setProfileSaving(true);
    setProfileError('');
    setProfileSuccess('');
    try {
      await apiPut('/auth/me', {
        full_name: profileForm.full_name,
        phone: profileForm.phone,
      });
      setProfileSuccess('Profil ma\'lumotlari saqlandi!');
      setTimeout(() => setProfileSuccess(''), 3000);
    } catch (err: any) {
      setProfileError(err.message || 'Saqlashda xatolik');
    } finally {
      setProfileSaving(false);
    }
  };

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const res = await apiGet('/organizations/ai-settings');
      if (res.data) {
        setForm({
          bot_name: res.data.bot_name || '',
          personality: res.data.personality || '',
          welcome_message: res.data.welcome_message || '',
          delivery_terms: res.data.delivery_terms || '',
          payment_terms: res.data.payment_terms || '',
          language: res.data.language || 'uz',
          auto_order: res.data.auto_order || false,
        });
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      await apiPut('/organizations/ai-settings', form);
      setSuccess('Sozlamalar saqlandi!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const set = (key: string, value: any) => setForm(f => ({ ...f, [key]: value }));

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Settings className="w-5 h-5 text-indigo-400" /> AI Sotuvchi Sozlamalari
          </h2>
          <p className="text-xs text-slate-400 mt-1">AI botining xulq-atvori, do&apos;kon qoidalari va yetkazib berish shartlarini sozlash.</p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-sm transition-all shadow-lg shadow-indigo-600/30 flex items-center gap-2 disabled:opacity-50"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Saqlash
        </button>
      </div>

      {success && (
        <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-sm flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" /> {success}
        </div>
      )}
      {error && (
        <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4" /> {error}
        </div>
      )}

      {profileError && (
        <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4" /> {profileError}
        </div>
      )}

      {/* Profile Settings */}
      <div className="glass-panel p-6 rounded-2xl border border-slate-800 space-y-5 shadow-lg">
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <User className="w-4 h-4 text-indigo-400" /> Profil ma&apos;lumotlari
          </h3>
          <button
            onClick={handleProfileSave}
            disabled={profileSaving}
            className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs transition-all shadow-md shadow-indigo-600/30 flex items-center gap-1.5 disabled:opacity-50"
          >
            {profileSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            Saqlash
          </button>
        </div>
        {profileSuccess && (
          <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-3.5 h-3.5" /> {profileSuccess}
          </div>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-semibold text-slate-300 mb-1.5 block">To&apos;liq ism</label>
            <input
              type="text"
              value={profileForm.full_name}
              onChange={(e) => setProfileForm(f => ({ ...f, full_name: e.target.value }))}
              className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-sm focus:outline-none focus:border-indigo-500 transition-colors"
              placeholder="Ismingiz"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-300 mb-1.5 block">Telefon raqam</label>
            <input
              type="tel"
              value={profileForm.phone}
              onChange={(e) => setProfileForm(f => ({ ...f, phone: e.target.value }))}
              className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-sm focus:outline-none focus:border-indigo-500 transition-colors"
              placeholder="+998 90 123 45 67"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="text-xs font-semibold text-slate-300 mb-1.5 block">Email (o&apos;zgartirib bo&apos;lmaydi)</label>
            <input
              type="email"
              value={profileForm.email}
              disabled
              className="w-full px-4 py-2.5 rounded-xl bg-slate-950/60 border border-slate-800 text-slate-500 text-sm cursor-not-allowed"
            />
          </div>
        </div>
      </div>

      <div className="glass-panel p-6 rounded-2xl border border-slate-800 space-y-5">
        {/* Bot Identity */}
        <div>
          <label className="text-xs font-semibold text-slate-300 mb-1 block flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-indigo-400" /> AI Sotuvchi Ismi
          </label>
          <input
            type="text"
            value={form.bot_name}
            onChange={(e) => set('bot_name', e.target.value)}
            className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-sm focus:outline-none focus:border-indigo-500"
            placeholder="AI Sotuvchi"
          />
        </div>

        <div>
          <label className="text-xs font-semibold text-slate-300 mb-1 block">Shaxsiyat (Personality)</label>
          <textarea
            value={form.personality}
            onChange={(e) => set('personality', e.target.value)}
            className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-sm focus:outline-none focus:border-indigo-500 resize-none"
            rows={3}
            placeholder="Professional, hushmuomala va do'stona sotuvchi..."
          />
          <p className="text-xs text-slate-500 mt-1">AI bu tavsilotga asoslanib muloqot qiladi.</p>
        </div>

        <div>
          <label className="text-xs font-semibold text-slate-300 mb-1 block">Salom xabari</label>
          <textarea
            value={form.welcome_message}
            onChange={(e) => set('welcome_message', e.target.value)}
            className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-sm focus:outline-none focus:border-indigo-500 resize-none"
            rows={2}
            placeholder="Assalomu alaykum! Qanday yordam bera olaman?"
          />
        </div>

        <div className="border-t border-slate-800 pt-5">
          <label className="text-xs font-semibold text-slate-300 mb-1 block flex items-center gap-1.5">
            <Truck className="w-3.5 h-3.5 text-indigo-400" /> Yetkazib berish shartlari
          </label>
          <textarea
            value={form.delivery_terms}
            onChange={(e) => set('delivery_terms', e.target.value)}
            className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-sm focus:outline-none focus:border-indigo-500 resize-none"
            rows={2}
            placeholder="Toshkent bo'ylab 30,000 so'm, 1-2 kun ichida..."
          />
        </div>

        <div>
          <label className="text-xs font-semibold text-slate-300 mb-1 block flex items-center gap-1.5">
            <CreditCard className="w-3.5 h-3.5 text-indigo-400" /> To&apos;lov shartlari
          </label>
          <textarea
            value={form.payment_terms}
            onChange={(e) => set('payment_terms', e.target.value)}
            className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-sm focus:outline-none focus:border-indigo-500 resize-none"
            rows={2}
            placeholder="Click, Payme yoki naqd pul..."
          />
        </div>

        <div className="border-t border-slate-800 pt-5">
          <label className="text-xs font-semibold text-slate-300 mb-3 block">Til</label>
          <div className="flex gap-3">
            {[{ code: 'uz', label: "O'zbek" }, { code: 'ru', label: 'Русский' }, { code: 'en', label: 'English' }].map(l => (
              <button
                key={l.code}
                onClick={() => set('language', l.code)}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                  form.language === l.code
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-800 text-slate-400 hover:text-white border border-slate-700'
                }`}
              >
                {l.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
