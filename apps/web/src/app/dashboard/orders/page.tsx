'use client';

import React, { useState, useEffect } from 'react';
import { ShoppingCart, Loader2, PackageOpen, Phone, MapPin, User, Search, RefreshCw, Eye, CheckCircle2 } from 'lucide-react';
import { apiGet, apiPut } from '@/lib/api';

export default function OrdersPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<any>(null);

  useEffect(() => {
    loadOrders(true);

    const interval = setInterval(() => {
      loadOrders(false);
    }, 5000);

    return () => clearInterval(interval);
  }, [statusFilter]);

  const loadOrders = async (showSpinner = false) => {
    try {
      if (showSpinner) setLoading(true);
      const query = statusFilter ? `?status=${statusFilter}` : '';
      const res = await apiGet(`/orders${query}`);
      setOrders(res.data || []);
    } catch (err) {
      console.error('Buyurtmalarni yuklashda xatolik:', err);
    } finally {
      if (showSpinner) setLoading(false);
    }
  };

  const updateStatus = async (orderId: string, newStatus: string) => {
    try {
      await apiPut(`/orders/${orderId}/status`, { status: newStatus });
      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: newStatus } : o));
      if (selectedOrder?.id === orderId) {
        setSelectedOrder({ ...selectedOrder, status: newStatus });
      }
    } catch (err) {
      console.error('Status yangilashda xatolik:', err);
    }
  };

  const statusColors: Record<string, string> = {
    PENDING: "bg-amber-500/20 text-amber-300 border border-amber-500/30",
    CONFIRMED: "bg-blue-500/20 text-blue-300 border border-blue-500/30",
    PROCESSING: "bg-indigo-500/20 text-indigo-300 border border-indigo-500/30",
    SHIPPED: "bg-purple-500/20 text-purple-300 border border-purple-500/30",
    DELIVERED: "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30",
    CANCELLED: "bg-red-500/20 text-red-300 border border-red-500/30",
  };

  const statusLabels: Record<string, string> = {
    PENDING: "Kutilmoqda",
    CONFIRMED: "Tasdiqlangan",
    PROCESSING: "Tayyorlanmoqda",
    SHIPPED: "Yetkazilmoqda (Yo'lda)",
    DELIVERED: "Yetkazib berildi",
    CANCELLED: "Bekor qilingan",
  };

  const allStatuses = ['PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED'];

  const filteredOrders = orders.filter(o => {
    const q = search.toLowerCase();
    return (
      (o.order_number || '').toLowerCase().includes(q) ||
      (o.customer_name || '').toLowerCase().includes(q) ||
      (o.customer_phone || '').toLowerCase().includes(q) ||
      (o.delivery_address || '').toLowerCase().includes(q)
    );
  });

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
            <ShoppingCart className="w-5 h-5 text-indigo-400" /> Buyurtmalar Boshqaruvi
          </h2>
          <p className="text-xs text-slate-400 mt-1">Telegram bot orqali tushgan real buyurtmalar va ularning ijro holati.</p>
        </div>

        <div className="flex items-center gap-3">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2.5 rounded-xl bg-slate-800/60 border border-slate-700 text-white text-xs focus:outline-none focus:border-indigo-500"
          >
            <option value="">Barcha statuslar</option>
            {allStatuses.map(s => (
              <option key={s} value={s}>{statusLabels[s]}</option>
            ))}
          </select>

          <button
            onClick={() => loadOrders(false)}
            className="p-2.5 rounded-xl bg-slate-800/60 border border-slate-700 text-slate-300 hover:text-white transition-colors"
            title="Yangilash"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Search Filter */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-3 rounded-xl bg-slate-800/50 border border-slate-700 text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 transition-colors text-sm"
          placeholder="Buyurtma raqami, mijoz ismi, telefon yoki manzil bo'yicha qidirish..."
        />
      </div>

      {/* Orders Table */}
      {filteredOrders.length === 0 ? (
        <div className="glass-panel p-12 rounded-2xl border border-slate-800 text-center">
          <PackageOpen className="w-16 h-16 text-slate-600 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-white mb-2">Hozircha buyurtmalar mavjud emas</h3>
          <p className="text-sm text-slate-400">Telegram bot orqali mijozlar buyurtma berganida shu yerda real vaqtda ko&apos;rinadi.</p>
        </div>
      ) : (
        <div className="glass-panel rounded-2xl border border-slate-800 overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-400 bg-slate-900/60 border-b border-slate-800">
                  <th className="p-4 font-semibold">Buyurtma №</th>
                  <th className="p-4 font-semibold">Mahsulot nomi</th>
                  <th className="p-4 font-semibold">Mijoz ma&apos;lumotlari</th>
                  <th className="p-4 font-semibold">Manzil</th>
                  <th className="p-4 font-semibold">Summa</th>
                  <th className="p-4 font-semibold">Status</th>
                  <th className="p-4 font-semibold">Sana</th>
                  <th className="p-4 font-semibold text-center">Batafsil</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {filteredOrders.map((order) => {
                  const itemsSummary = order.items && order.items.length > 0
                    ? order.items.map((it: any) => `${it.product_name} (${it.quantity} dona)`).join(', ')
                    : (order.notes || "Mahsulot");

                  return (
                    <tr key={order.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="p-4 font-mono font-bold text-indigo-300 whitespace-nowrap">
                        #{order.order_number}
                      </td>
                      <td className="p-4 max-w-xs">
                        <div className="font-semibold text-white truncate flex items-center gap-1.5" title={itemsSummary}>
                          <PackageOpen className="w-3.5 h-3.5 text-indigo-400 flex-shrink-0" />
                          <span className="truncate">{itemsSummary}</span>
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="font-semibold text-white flex items-center gap-1.5">
                          <User className="w-3.5 h-3.5 text-slate-400" />
                          {order.customer_name || 'Noma\'lum'}
                        </div>
                        {order.customer_phone && (
                          <a
                            href={`tel:${order.customer_phone}`}
                            className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 mt-0.5 font-mono"
                          >
                            <Phone className="w-3 h-3" />
                            {order.customer_phone}
                          </a>
                        )}
                      </td>
                      <td className="p-4 max-w-xs">
                        <div className="text-xs text-slate-300 flex items-start gap-1">
                          <MapPin className="w-3.5 h-3.5 text-slate-500 mt-0.5 flex-shrink-0" />
                          <span className="truncate">{order.delivery_address || '-'}</span>
                        </div>
                      </td>
                      <td className="p-4 font-bold text-emerald-400 whitespace-nowrap">
                        {Number(order.total_amount || 0).toLocaleString()} UZS
                      </td>
                      <td className="p-4">
                        <select
                          value={order.status}
                          onChange={(e) => updateStatus(order.id, e.target.value)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold focus:outline-none cursor-pointer transition-all ${statusColors[order.status] || 'bg-slate-800 text-white'}`}
                        >
                          {allStatuses.map(s => (
                            <option key={s} value={s} className="bg-slate-900 text-white">{statusLabels[s]}</option>
                          ))}
                        </select>
                      </td>
                      <td className="p-4 text-slate-400 text-xs whitespace-nowrap">
                        {order.created_at ? new Date(order.created_at).toLocaleString('uz', { dateStyle: 'short', timeStyle: 'short' }) : '-'}
                      </td>
                      <td className="p-4 text-center">
                        <button
                          onClick={() => setSelectedOrder(order)}
                          className="px-3 py-1.5 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 text-xs font-semibold flex items-center justify-center gap-1 border border-indigo-500/30 transition-all mx-auto shadow-sm"
                          title="Barcha ma'lumotlarni ko'rish"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Ko&apos;rish</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Order Detail Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-lg glass-panel rounded-2xl p-6 border border-slate-700 shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-lg font-bold text-white">Buyurtma #{selectedOrder.order_number}</h3>
                <p className="text-xs text-slate-400">
                  {selectedOrder.created_at ? new Date(selectedOrder.created_at).toLocaleString('uz') : ''}
                </p>
              </div>
              <span className={`px-3 py-1 rounded-full text-xs font-semibold ${statusColors[selectedOrder.status]}`}>
                {statusLabels[selectedOrder.status]}
              </span>
            </div>

            {/* Customer Info */}
            <div className="p-3.5 bg-slate-900/60 rounded-xl border border-slate-800 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400">Mijoz:</span>
                <span className="text-white font-semibold">{selectedOrder.customer_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Telefon:</span>
                <a href={`tel:${selectedOrder.customer_phone}`} className="text-indigo-400 font-mono font-medium">
                  {selectedOrder.customer_phone}
                </a>
              </div>
              <div className="flex justify-between items-start">
                <span className="text-slate-400">Yetkazish manzili:</span>
                <span className="text-slate-200 text-right max-w-xs">{selectedOrder.delivery_address}</span>
              </div>
            </div>

            {/* Items */}
            <div>
              <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wide mb-2">Tarkibi</h4>
              {selectedOrder.items && selectedOrder.items.length > 0 ? (
                <div className="space-y-2">
                  {selectedOrder.items.map((it: any, idx: number) => (
                    <div key={idx} className="flex justify-between items-center p-2.5 bg-slate-800/40 rounded-xl text-xs">
                      <div>
                        <div className="text-white font-semibold">{it.product_name}</div>
                        <div className="text-slate-400">{it.quantity} dona x {Number(it.price || 0).toLocaleString()} UZS</div>
                      </div>
                      <div className="font-bold text-indigo-300">
                        {Number(it.total || 0).toLocaleString()} UZS
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-500 italic">Tarkib ma&apos;lumotlari qayd etilmagan</p>
              )}
            </div>

            {/* Total Amount */}
            <div className="flex justify-between items-center pt-3 border-t border-slate-800">
              <span className="text-sm font-semibold text-slate-300">Jami to&apos;lov:</span>
              <span className="text-lg font-bold text-emerald-400">
                {Number(selectedOrder.total_amount || 0).toLocaleString()} UZS
              </span>
            </div>

            <div className="pt-2">
              <button
                onClick={() => setSelectedOrder(null)}
                className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-sm transition-all"
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
