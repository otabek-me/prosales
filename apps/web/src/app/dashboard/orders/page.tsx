'use client';

import React, { useState, useEffect } from 'react';
import { ShoppingCart, Loader2, PackageOpen, ChevronDown } from 'lucide-react';
import { apiGet, apiPut } from '../../..//lib/api';

export default function OrdersPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');

  useEffect(() => {
    loadOrders();
  }, [statusFilter]);

  const loadOrders = async () => {
    try {
      setLoading(true);
      const query = statusFilter ? `?status=${statusFilter}` : '';
      const res = await apiGet(`/orders${query}`);
      setOrders(res.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (orderId: string, newStatus: string) => {
    try {
      await apiPut(`/orders/${orderId}/status`, { status: newStatus });
      await loadOrders();
    } catch (err) {
      console.error(err);
    }
  };

  const statusColors: Record<string, string> = {
    PENDING: "bg-yellow-500/20 text-yellow-400",
    CONFIRMED: "bg-blue-500/20 text-blue-400",
    PROCESSING: "bg-indigo-500/20 text-indigo-400",
    SHIPPED: "bg-purple-500/20 text-purple-400",
    DELIVERED: "bg-emerald-500/20 text-emerald-400",
    CANCELLED: "bg-red-500/20 text-red-400",
  };

  const statusLabels: Record<string, string> = {
    PENDING: "Kutilmoqda",
    CONFIRMED: "Tasdiqlangan",
    PROCESSING: "Tayyorlanmoqda",
    SHIPPED: "Yo'lda",
    DELIVERED: "Yetkazildi",
    CANCELLED: "Bekor qilingan",
  };

  const allStatuses = ['PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED'];

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
            <ShoppingCart className="w-5 h-5 text-indigo-400" /> Buyurtmalar
          </h2>
          <p className="text-xs text-slate-400 mt-1">Telegram bot orqali tushgan barcha buyurtmalar.</p>
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-2.5 rounded-xl bg-slate-800/50 border border-slate-700 text-white text-sm focus:outline-none focus:border-indigo-500"
        >
          <option value="">Barcha statuslar</option>
          {allStatuses.map(s => (
            <option key={s} value={s}>{statusLabels[s]}</option>
          ))}
        </select>
      </div>

      {orders.length === 0 ? (
        <div className="glass-panel p-12 rounded-2xl border border-slate-800 text-center">
          <PackageOpen className="w-16 h-16 text-slate-600 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-white mb-2">Hozircha buyurtmalar yo&apos;q</h3>
          <p className="text-sm text-slate-400">Telegram bot orqali mijozlar buyurtma berganida shu yerda ko&apos;rinadi.</p>
        </div>
      ) : (
        <div className="glass-panel rounded-2xl border border-slate-800 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-500 border-b border-slate-800">
                <th className="p-4 font-medium">Buyurtma №</th>
                <th className="p-4 font-medium">Summa</th>
                <th className="p-4 font-medium">Status</th>
                <th className="p-4 font-medium">Sana</th>
                <th className="p-4 font-medium">Amal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {orders.map((order) => (
                <tr key={order.id} className="hover:bg-slate-800/30 transition-colors">
                  <td className="p-4 text-white font-medium">{order.order_number}</td>
                  <td className="p-4 text-white">{Number(order.total_amount || 0).toLocaleString()} UZS</td>
                  <td className="p-4">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${statusColors[order.status] || ''}`}>
                      {statusLabels[order.status] || order.status}
                    </span>
                  </td>
                  <td className="p-4 text-slate-400 text-xs">
                    {order.created_at ? new Date(order.created_at).toLocaleDateString('uz') : '-'}
                  </td>
                  <td className="p-4">
                    <select
                      value={order.status}
                      onChange={(e) => updateStatus(order.id, e.target.value)}
                      className="px-2 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-white text-xs focus:outline-none focus:border-indigo-500"
                    >
                      {allStatuses.map(s => (
                        <option key={s} value={s}>{statusLabels[s]}</option>
                      ))}
                    </select>
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
