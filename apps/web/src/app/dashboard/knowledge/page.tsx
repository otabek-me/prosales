'use client';

import React, { useState, useEffect } from 'react';
import { BookOpen, Plus, Trash2, Loader2, HelpCircle, CheckCircle2, AlertCircle } from 'lucide-react';
import { apiGet, apiPost, apiDelete } from '@/lib/api';

export default function KnowledgeBasePage() {
  const [faqs, setFaqs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [newFaq, setNewFaq] = useState({ question: '', answer: '' });

  useEffect(() => {
    loadFaqs();
  }, []);

  const loadFaqs = async () => {
    try {
      setLoading(true);
      const res = await apiGet('/knowledge/faqs');
      setFaqs(res.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async () => {
    if (!newFaq.question || !newFaq.answer) return;
    setSaving(true);
    setError('');
    try {
      await apiPost('/knowledge/faqs', newFaq);
      setShowAdd(false);
      setNewFaq({ question: '', answer: '' });
      setSuccess("FAQ qo'shildi!");
      setTimeout(() => setSuccess(''), 3000);
      await loadFaqs();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("FAQ ni o'chirishni xohlaysizmi?")) return;
    try {
      await apiDelete(`/knowledge/faqs/${id}`);
      await loadFaqs();
    } catch (err: any) {
      setError(err.message);
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
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-indigo-400" /> Bilimlar Bazasi (FAQ)
          </h2>
          <p className="text-xs text-slate-400 mt-1">AI bot savollarga javob berish uchun shu ma&apos;lumotlardan foydalanadi.</p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs transition-all shadow-lg shadow-indigo-600/30 flex items-center gap-2"
        >
          <Plus className="w-4 h-4" /> Yangi FAQ
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

      {faqs.length === 0 ? (
        <div className="glass-panel p-12 rounded-2xl border border-slate-800 text-center">
          <HelpCircle className="w-16 h-16 text-slate-600 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-white mb-2">Hozircha FAQ yo&apos;q</h3>
          <p className="text-sm text-slate-400 mb-4">Ko&apos;p beriladigan savollar qo&apos;shib AI botingizni aqlliroq qiling.</p>
          <button
            onClick={() => setShowAdd(true)}
            className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-sm transition-all"
          >
            <Plus className="w-4 h-4 inline mr-1" /> Birinchi FAQ qo&apos;shing
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {faqs.map((faq) => (
            <div key={faq.id} className="glass-panel p-5 rounded-2xl border border-slate-800 hover:border-slate-700 transition-all">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <h4 className="text-sm font-semibold text-white flex items-center gap-2">
                    <HelpCircle className="w-4 h-4 text-indigo-400 flex-shrink-0" />
                    {faq.question}
                  </h4>
                  <p className="text-sm text-slate-400 mt-2 pl-6">{faq.answer}</p>
                </div>
                <button
                  onClick={() => handleDelete(faq.id)}
                  className="p-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-colors flex-shrink-0"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add FAQ Modal */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-lg glass-panel rounded-2xl p-6 border border-slate-700 shadow-2xl">
            <h3 className="text-lg font-bold text-white mb-4">Yangi FAQ Qo&apos;shish</h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Savol *</label>
                <input
                  value={newFaq.question}
                  onChange={(e) => setNewFaq({ ...newFaq, question: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-800/50 border border-slate-700 text-white text-sm focus:outline-none focus:border-indigo-500"
                  placeholder="Yetkazib berish shartlari qanday?"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Javob *</label>
                <textarea
                  value={newFaq.answer}
                  onChange={(e) => setNewFaq({ ...newFaq, answer: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-800/50 border border-slate-700 text-white text-sm focus:outline-none focus:border-indigo-500 resize-none"
                  rows={3}
                  placeholder="Toshkent bo'ylab 30,000 so'm, 1-2 kun ichida..."
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowAdd(false)} className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium text-sm transition-all border border-slate-700">
                Bekor qilish
              </button>
              <button
                onClick={handleAdd}
                disabled={saving || !newFaq.question || !newFaq.answer}
                className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-sm transition-all shadow-lg shadow-indigo-600/30 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                Qo&apos;shish
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
