'use client';

import React, { useState, useEffect } from 'react';
import { Users, Search, Loader2, UserX, MessageSquare, Phone, ShoppingCart, Eye, ExternalLink, Calendar, DollarSign, Tag, RefreshCw } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { apiGet, apiPut } from '@/lib/api';

export default function CustomersPage() {
  const router = useRouter();
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [stageFilter, setStageFilter] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);

  useEffect(() => {
    loadCustomers(true);
  }, [stageFilter]);

  const loadCustomers = async (showSpinner = false) => {
    try {
      if (showSpinner) setLoading(true);
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
      if (showSpinner) setLoading(false);
    }
  };

  const handleSearch = () => {
    loadCustomers(true);
  };

  const updateStage = async (customerId: string, newStage: string) => {
    try {
      await apiPut(`/customers/${customerId}`, { stage: newStage });
      setCustomers(prev => prev.map(c => c.id === customerId ? { ...c, stage: newStage } : c));
      if (selectedCustomer?.id === customerId) {
        setSelectedCustomer({ ...selectedCustomer, stage: newStage });
      }
    } catch (err) {
      console.error(err);
    }
  };

  const openCustomerChat = (customerId: string) => {
    // Navigate to inbox with query parameter
    router.push(`/dashboard/inbox?customer_id=${customerId}`);
  };

  const stageLabels: Record<string, string> = {
    NEW: "Yangi",
    INTERESTED: "Qiziqqan",
    CONSIDERING: "O'ylayapti",
    READY_TO_BUY: "Sotib olishga tayyor",
    ORDERED: "Buyurtma berdi",
    COMPLETED: "Tugallangan",
    LOST: "Yo'qotilgan",
  };

  const stageColors: Record<string, string> = {
    NEW: "bg-blue-500/20 text-blue-300 border border-blue-500/30",
    INTERESTED: "bg-cyan-500/20 text-cyan-300 border border-cyan-500/30",
    CONSIDERING: "bg-amber-500/20 text-amber-300 border border-amber-500/30",
    READY_TO_BUY: "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30",
    ORDERED: "bg-purple-500/20 text-purple-300 border border-purple-500/30",
    COMPLETED: "bg-green-500/20 text-green-300 border border-green-500/30",
    LOST: "bg-red-500/20 text-red-300 border border-red-500/30",
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
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Users className="w-5 h-5 text-indigo-400" /> Mijozlar Bazasi (CRM)
          </h2>
          <p className="text-xs text-slate-400 mt-1">Telegram bot orqali muloqot qilgan va xarid qilgan barcha mijozlar.</p>
        </div>

        <div className="flex items-center gap-3">
          <select
            value={stageFilter}
            onChange={(e) => setStageFilter(e.target.value)}
            className="px-4 py-2.5 rounded-xl bg-slate-800/60 border border-slate-700 text-white text-xs focus:outline-none focus:border-indigo-500"
          >
            <option value="">Barcha bosqichlar</option>
            {allStages.map(s => (
              <option key={s} value={s}>{stageLabels[s]}</option>
            ))}
          </select>

          <button
            onClick={() => loadCustomers(false)}
            className="p-2.5 rounded-xl bg-slate-800/60 border border-slate-700 text-slate-300 hover:text-white transition-colors"
            title="Yangilash"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Search Filter */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            className="w-full pl-10 pr-4 py-3 rounded-xl bg-slate-800/50 border border-slate-700 text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 transition-colors text-sm"
            placeholder="Mijoz ismi, @username, telefon yoki manzil bo'yicha qidirish..."
          />
        </div>
        <button
          onClick={handleSearch}
          className="px-5 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-all shadow-md shadow-indigo-600/30"
        >
          Qidirish
        </button>
      </div>

      {/* Table */}
      {customers.length === 0 ? (
        <div className="glass-panel p-12 rounded-2xl border border-slate-800 text-center">
          <UserX className="w-16 h-16 text-slate-600 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-white mb-2">Hozircha mijozlar mavjud emas</h3>
          <p className="text-sm text-slate-400">Telegram botingizga yozgan mijozlar shu yerda avtomatik ko&apos;rinadi.</p>
        </div>
      ) : (
        <div className="glass-panel rounded-2xl border border-slate-800 overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-400 bg-slate-900/60 border-b border-slate-800">
                  <th className="p-4 font-semibold">Mijoz</th>
                  <th className="p-4 font-semibold">Telegram / Telefon</th>
                  <th className="p-4 font-semibold">Bosqich (Funnel)</th>
                  <th className="p-4 font-semibold">Xaridlar</th>
                  <th className="p-4 font-semibold">Sana</th>
                  <th className="p-4 font-semibold text-center">Amallar</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {customers.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-purple-600 flex items-center justify-center text-white text-sm font-bold shadow-md">
                          {(c.first_name || 'M')[0]}
                        </div>
                        <div>
                          <div className="text-white font-semibold flex items-center gap-1.5">
                            {c.first_name || 'Mijoz'} {c.last_name || ''}
                          </div>
                          <div className="text-xs text-slate-400">ID: {c.telegram_id}</div>
                        </div>
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="text-xs text-slate-300">
                        {c.username ? (
                          <a
                            href={`https://t.me/${c.username}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
                          >
                            @{c.username} <ExternalLink className="w-3 h-3" />
                          </a>
                        ) : (
                          <span className="text-slate-500">-</span>
                        )}
                      </div>
                      {c.phone && (
                        <a
                          href={`tel:${c.phone}`}
                          className="text-xs text-slate-300 hover:text-white flex items-center gap-1 mt-0.5"
                        >
                          <Phone className="w-3 h-3 text-slate-500" />
                          {c.phone}
                        </a>
                      )}
                    </td>
                    <td className="p-4">
                      <select
                        value={c.stage}
                        onChange={(e) => updateStage(c.id, e.target.value)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold focus:outline-none cursor-pointer transition-all ${stageColors[c.stage] || 'bg-slate-800 text-white'}`}
                      >
                        {allStages.map(s => (
                          <option key={s} value={s} className="bg-slate-900 text-white">{stageLabels[s]}</option>
                        ))}
                      </select>
                    </td>
                    <td className="p-4">
                      <div className="text-xs font-semibold text-white">
                        {c.total_orders || 0} ta buyurtma
                      </div>
                      <div className="text-[11px] text-emerald-400 font-medium mt-0.5">
                        {Number(c.total_spent || 0).toLocaleString()} UZS
                      </div>
                    </td>
                    <td className="p-4 text-slate-400 text-xs whitespace-nowrap">
                      {c.created_at ? new Date(c.created_at).toLocaleDateString('uz') : '-'}
                    </td>
                    <td className="p-4">
                      <div className="flex items-center justify-center gap-2">
                        {/* Direct Chat Button */}
                        <button
                          onClick={() => openCustomerChat(c.id)}
                          className="px-3 py-1.5 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 text-xs font-semibold flex items-center gap-1.5 border border-indigo-500/30 transition-all shadow-sm"
                          title="Suhbatni ochish"
                        >
                          <MessageSquare className="w-3.5 h-3.5 text-indigo-400" />
                          <span>Chat</span>
                        </button>

                        {/* Profile Detail */}
                        <button
                          onClick={() => setSelectedCustomer(c)}
                          className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors border border-slate-700"
                          title="Batafsil ma'lumot"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Customer Detail Modal */}
      {selectedCustomer && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-lg glass-panel rounded-2xl p-6 border border-slate-700 shadow-2xl space-y-4">
            <div className="flex justify-between items-start border-b border-slate-800 pb-3">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-indigo-600 to-purple-600 flex items-center justify-center text-white text-base font-bold shadow-md">
                  {(selectedCustomer.first_name || 'M')[0]}
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">
                    {selectedCustomer.first_name || 'Mijoz'} {selectedCustomer.last_name || ''}
                  </h3>
                  <p className="text-xs text-slate-400">Telegram ID: {selectedCustomer.telegram_id}</p>
                </div>
              </div>
              <span className={`px-3 py-1 rounded-full text-xs font-semibold ${stageColors[selectedCustomer.stage]}`}>
                {stageLabels[selectedCustomer.stage]}
              </span>
            </div>

            {/* Contact Details */}
            <div className="p-4 bg-slate-900/60 rounded-xl border border-slate-800 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400">Telegram Username:</span>
                {selectedCustomer.username ? (
                  <a
                    href={`https://t.me/${selectedCustomer.username}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-indigo-400 hover:underline flex items-center gap-1"
                  >
                    @{selectedCustomer.username} <ExternalLink className="w-3 h-3" />
                  </a>
                ) : (
                  <span className="text-slate-500">-</span>
                )}
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Telefon:</span>
                <span className="text-white font-mono">{selectedCustomer.phone || '-'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Jami buyurtmalar:</span>
                <span className="text-white font-bold">{selectedCustomer.total_orders || 0} ta</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Jami xarid summasi:</span>
                <span className="text-emerald-400 font-bold">{Number(selectedCustomer.total_spent || 0).toLocaleString()} UZS</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Qo&apos;shilgan sana:</span>
                <span className="text-slate-300">
                  {selectedCustomer.created_at ? new Date(selectedCustomer.created_at).toLocaleString('uz') : '-'}
                </span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => {
                  const id = selectedCustomer.id;
                  setSelectedCustomer(null);
                  openCustomerChat(id);
                }}
                className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/30"
              >
                <MessageSquare className="w-4 h-4" /> Suhbatni ochish
              </button>
              <button
                onClick={() => setSelectedCustomer(null)}
                className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors"
              >
                Yopish
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
