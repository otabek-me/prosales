'use client';

import React, { useState, useEffect } from 'react';
import { Bot, Link2, Link2Off, Loader2, CheckCircle2, AlertCircle, ExternalLink } from 'lucide-react';
import { apiGet, apiPost, apiDelete } from '../../../lib/api';

export default function BotSettingsPage() {
  const [bot, setBot] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [token, setToken] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    loadStatus();
  }, []);

  const loadStatus = async () => {
    try {
      setLoading(true);
      const res = await apiGet('/bots/status');
      setBot(res.data || null);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async () => {
    if (!token.trim()) return;
    setConnecting(true);
    setError('');
    try {
      await apiPost('/bots/connect', { bot_token: token });
      setToken('');
      setSuccess('Telegram bot muvaffaqiyatli ulandi!');
      setTimeout(() => setSuccess(''), 4000);
      await loadStatus();
    } catch (err: any) {
      setError(err.message || 'Ulanishda xatolik yuz berdi');
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm('Botni uzmoqchimisiz?')) return;
    setDisconnecting(true);
    setError('');
    try {
      await apiDelete('/bots/disconnect');
      setBot(null);
      setSuccess('Bot uzildi.');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setDisconnecting(false);
    }
  };

  const [syncingWh, setSyncingWh] = useState(false);

  const handleSyncWebhook = async () => {
    setSyncingWh(true);
    setError('');
    try {
      const res = await apiPost('/bots/sync-webhook', {});
      if (res.data?.status === 'CONNECTED') {
        setSuccess('Webhook muvaffaqiyatli sinxronlandi va Telegramga ulandi!');
      } else {
        setError(res.data?.error || 'Webhook o\'rnatishda xatolik yuz berdi.');
      }
      setTimeout(() => setSuccess(''), 4000);
      await loadStatus();
    } catch (err: any) {
      setError(err.message || 'Webhookni sinxronlashda xatolik');
    } finally {
      setSyncingWh(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <Bot className="w-5 h-5 text-indigo-400" /> Telegram Bot & Webhook Boshqaruvi
        </h2>
        <p className="text-xs text-slate-400 mt-1">Telegram botingizni ulang va .env dagi domen orqali avtomatik Webhookni boshqaring.</p>
      </div>

      {success && (
        <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-sm flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 flex-shrink-0" /> {success}
        </div>
      )}
      {error && (
        <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" /> {error}
        </div>
      )}

      {bot ? (
        /* Connected State */
        <div className="glass-panel p-6 rounded-2xl border border-emerald-500/30 shadow-xl space-y-5">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-emerald-500/20 flex items-center justify-center">
              <Bot className="w-6 h-6 text-emerald-400" />
            </div>
            <div>
              <h3 className="text-white font-semibold">{bot.bot_name || 'Telegram Bot'}</h3>
              <p className="text-sm text-slate-400">@{bot.bot_username || '-'}</p>
            </div>
            {bot.status === 'WEBHOOK_FAILED' ? (
              <span className="ml-auto px-3 py-1 rounded-full bg-amber-500/20 text-amber-400 text-xs font-semibold flex items-center gap-1 border border-amber-500/30">
                <AlertCircle className="w-3.5 h-3.5" />
                WEBHOOK XATOSI
              </span>
            ) : (
              <span className="ml-auto px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-semibold flex items-center gap-1 border border-emerald-500/30">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Faol (Ulangan)
              </span>
            )}
          </div>

          {/* Webhook & Server Info Box */}
          <div className="p-4 bg-slate-900/60 rounded-xl border border-slate-800 space-y-2.5 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Holati:</span>
              <span className="text-white font-semibold font-mono">{bot.status}</span>
            </div>
            {bot.webhook_url && (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                <span className="text-slate-400">O&apos;rnatilgan Webhook URL:</span>
                <span className="text-indigo-400 font-mono break-all">{bot.webhook_url}</span>
              </div>
            )}
            {bot.webhook_info?.last_error_message && (
              <div className="flex flex-col gap-1 p-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-300">
                <span className="font-semibold">Telegram oxirgi xabari:</span>
                <span>{bot.webhook_info.last_error_message}</span>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
            <a
              href={`https://t.me/${bot.bot_username}`}
              target="_blank"
              rel="noopener noreferrer"
              className="py-2.5 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs text-center transition-all flex items-center justify-center gap-1.5 shadow-md shadow-indigo-600/30"
            >
              <ExternalLink className="w-3.5 h-3.5" /> Botni ochish
            </a>

            <button
              onClick={handleSyncWebhook}
              disabled={syncingWh}
              className="py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium text-xs transition-all flex items-center justify-center gap-1.5 border border-slate-700 disabled:opacity-50"
            >
              {syncingWh ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Link2 className="w-3.5 h-3.5" />}
              Webhookni yangilash
            </button>

            <button
              onClick={handleDisconnect}
              disabled={disconnecting}
              className="py-2.5 px-3 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 font-medium text-xs transition-all flex items-center justify-center gap-1.5 border border-red-500/20 disabled:opacity-50"
            >
              {disconnecting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Link2Off className="w-3.5 h-3.5" />}
              Uzish
            </button>
          </div>
        </div>
      ) : (
        /* Disconnected State */
        <div className="glass-panel p-6 rounded-2xl border border-slate-800">
          <div className="text-center mb-6">
            <div className="w-16 h-16 rounded-2xl bg-slate-800 flex items-center justify-center mx-auto mb-3">
              <Bot className="w-8 h-8 text-slate-500" />
            </div>
            <h3 className="text-white font-semibold mb-1">Bot ulanmagan</h3>
            <p className="text-sm text-slate-400">@BotFather dan token olib ulang</p>
          </div>

          {/* Steps */}
          <div className="space-y-3 mb-6">
            {[
              { step: '1', text: 'Telegramda @BotFather ga yozing' },
              { step: '2', text: '/newbot buyrug\'ini yuboring' },
              { step: '3', text: 'Bot nomi va username kiriting' },
              { step: '4', text: 'Tokenni nusxalab pastga joylashtiring' },
            ].map((s) => (
              <div key={s.step} className="flex items-center gap-3 text-sm text-slate-300">
                <span className="w-6 h-6 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center text-xs font-bold flex-shrink-0">
                  {s.step}
                </span>
                {s.text}
              </div>
            ))}
          </div>

          <div>
            <label className="text-xs text-slate-400 mb-1 block">Bot Token</label>
            <input
              value={token}
              onChange={(e) => setToken(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-slate-800/50 border border-slate-700 text-white text-sm placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 transition-colors mb-3"
              placeholder="7182930491:AAH829x_SampleTokenKey123891"
            />
            <button
              onClick={handleConnect}
              disabled={connecting || !token.trim()}
              className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-sm transition-all shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {connecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />}
              Botni ulash
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
