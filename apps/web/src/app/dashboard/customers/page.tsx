'use client';

import React, { useState, useEffect } from 'react';
import { Users, Search, Loader2, UserX } from 'lucide-react';
import { apiGet, apiPut } from '@/lib/api';

export default function CustomersPage() {
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [stageFilter, setStageFilter] = useState('');

  useEffect(() => {
    loadCustomers();
  }, [stageFilter]);

  const loadCustomers = async () => {
    try {
      setLoading(true);
      let query = '';
      const params: string[] = [];
      if (stageFilter) params.push(`stage=${stageFilter}`);
      if (search) params.push(`search=${encodeURIComponent(search)}`);
      if (params.length > 0) query = `?${params.join('&')}`;
      const res = await apiGet(`/customers${query}`);
      setCustomers(res.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    loadCustomers();
  };

  const updateStage = async (customerId: string, newStage: string) => {
    try {
      await apiPut(`/customers/${customerId}`, { stage: newStage });
      await loadCustomers();
    } catch (err) {
      console.error(err);
    }
  };

  const stageLabels: Record<string, string> = {
    NEW: "Yangi",
    INTERESTED: "Qiziqgan",
    CONSIDERING: "O'ylayapti",
    READY_TO_BUY: "Sotib olishga tayyor",
    ORDERED: "Buyurtma berdi",
    COMPLETED: "Tugallangan",
    LOST: "Yo'qotilgan",
  };

  const stageColors: Record<string, string> = {
    NEW: "bg-blue-500/20 text-blue-400",
    INTERESTED: "bg-cyan-500/20 text-cyan-400",
    CONSIDERING: "bg-yellow-500/20 text-yellow-400",
    READY_TO_BUY: "bg-emerald-500/20 text-emerald-400",
    ORDERED: "bg-purple-500/20 text-purple-400",
    COMPLETED: "bg-green-500/20 text-green-400",
    LOST: "bg-red-500/20 text-red-400",
  };

  const allStages = Object.keys(stageLabels);

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
            <Users className="w-5 h-5 text-indigo-400" /> Mijozlar (CRM)
          </h2>
          <p className="text-xs text-slate-400 mt-1">Telegram orqali muloqot qilgan barcha mijozlar.</p>
        </div>

        <select
          value={stageFilter}
          onChange={(e) => setStageFilter(e.target.value)}
          className="px-4 py-2.5 rounded-xl bg-slate-800/50 border border-slate-700 text-white text-sm focus:outline-none focus:border-indigo-500"
        >
          <option value="">Barcha bosqichlar</option>
          {allStages.map(s => (
            <option key={s} value={s}>{stageLabels[s]}</option>
          ))}
        </select>
      </div>

      {/* Search */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            className="w-full pl-10 pr-4 py-3 rounded-xl bg-slate-800/50 border border-slate-700 text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 transition-colors text-sm"
            placeholder="Ism, username yoki telefon bo'yicha qidirish..."
          />
        </div>
        <button onClick={handleSearch} className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition-all">
          Qidirish
        </button>
      </div>

      {customers.length === 0 ? (
        <div className="glass-panel p-12 rounded-2xl border border-slate-800 text-center">
          <UserX className="w-16 h-16 text-slate-600 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-white mb-2">Hozircha mijozlar yo&apos;q</h3>
          <p className="text-sm text-slate-400">Telegram botingizga yozgan odamlar avtomatik shu yerda ko&apos;rinadi.</p>
        </div>
      ) : (
        <div className="glass-panel rounded-2xl border border-slate-800 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-500 border-b border-slate-800">
                <th className="p-4 font-medium">Mijoz</th>
                <th className="p-4 font-medium">Username</th>
                <th className="p-4 font-medium">Telefon</th>
                <th className="p-4 font-medium">Bosqich</th>
                <th className="p-4 font-medium">Qo&apos;shilgan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {customers.map((c) => (
                <tr key={c.id} className="hover:bg-slate-800/30 transition-colors">
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center text-white text-xs font-bold">
                        {(c.first_name || '?')[0]}
                      </div>
                      <div>
                        <div className="text-white font-medium">{c.first_name} {c.last_name || ''}</div>
                      </div>
                    </div>
                  </td>
                  <td className="p-4 text-slate-400">@{c.username || '-'}</td>
                  <td className="p-4 text-slate-400">{c.phone || '-'}</td>
                  <td className="p-4">
                    <select
                      value={c.stage}
                      onChange={(e) => updateStage(c.id, e.target.value)}
                      className={`px-2 py-1.5 rounded-lg text-xs font-medium border-0 focus:outline-none ${stageColors[c.stage] || 'bg-slate-700 text-slate-300'}`}
                    >
                      {allStages.map(s => (
                        <option key={s} value={s}>{stageLabels[s]}</option>
                      ))}
                    </select>
                  </td>
                  <td className="p-4 text-slate-400 text-xs">
                    {c.created_at ? new Date(c.created_at).toLocaleDateString('uz') : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
