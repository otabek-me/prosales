'use client';

import React, { useState, useEffect } from 'react';
import { Plus, Search, ShoppingBag, Trash2, CheckCircle2, AlertCircle, Loader2, PackageOpen } from 'lucide-react';
import { apiGet, apiPost, apiDelete } from '@/lib/api';

export default function ProductsCatalog() {
  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [newProd, setNewProd] = useState({
    name: '',
    category_id: '',
    price: '',
    stock: '',
    sku: '',
    description: '',
    currency: 'UZS'
  });

  useEffect(() => {
    loadProducts();
    loadCategories();
  }, []);

  const loadProducts = async () => {
    try {
      setLoading(true);
      const res = await apiGet('/products');
      setProducts(res.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadCategories = async () => {
    try {
      const res = await apiGet('/products/categories');
      setCategories(res.data || []);
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddProduct = async () => {
    if (!newProd.name || !newProd.price) return;
    setSaving(true);
    setError('');
    try {
      await apiPost('/products', {
        name: newProd.name,
        description: newProd.description || undefined,
        sku: newProd.sku || undefined,
        price: parseFloat(newProd.price),
        stock: parseInt(newProd.stock || '0'),
        currency: 'UZS',
        category_id: newProd.category_id || undefined,
      });
      setShowAddModal(false);
      setNewProd({ name: '', category_id: '', price: '', stock: '', sku: '', description: '', currency: 'UZS' });
      setSuccess("Mahsulot qo'shildi!");
      setTimeout(() => setSuccess(''), 3000);
      await loadProducts();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Mahsulotni o'chirishni xohlaysizmi?")) return;
    try {
      await apiDelete(`/products/${id}`);
      await loadProducts();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const filtered = products.filter(p => p.name?.toLowerCase().includes(search.toLowerCase()));

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <ShoppingBag className="w-5 h-5 text-indigo-400" /> Mahsulotlar Katalogi
          </h2>
          <p className="text-xs text-slate-400 mt-1">AI Telegram boti orqali mijozlarga tavsiya etiladigan mahsulotlar ro&apos;yxati.</p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs transition-all shadow-lg shadow-indigo-600/30 flex items-center gap-2"
        >
          <Plus className="w-4 h-4" /> Yangi Mahsulot Qo&apos;shish
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

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-3 rounded-xl bg-slate-800/50 border border-slate-700 text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 transition-colors text-sm"
          placeholder="Mahsulot nomi bo'yicha qidirish..."
        />
      </div>

      {/* Products Table */}
      {filtered.length === 0 ? (
        <div className="glass-panel p-12 rounded-2xl border border-slate-800 text-center">
          <PackageOpen className="w-16 h-16 text-slate-600 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-white mb-2">Hozircha mahsulot yo&apos;q</h3>
          <p className="text-sm text-slate-400 mb-4">Yangi mahsulot qo&apos;shib, AI botingiz mijozlarga tavsiya qilishni boshlaydi.</p>
          <button
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-sm transition-all"
          >
            <Plus className="w-4 h-4 inline mr-1" /> Birinchi mahsulotni qo&apos;shing
          </button>
        </div>
      ) : (
        <div className="glass-panel rounded-2xl border border-slate-800 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-500 border-b border-slate-800">
                <th className="p-4 font-medium">Mahsulot</th>
                <th className="p-4 font-medium">SKU</th>
                <th className="p-4 font-medium">Narx</th>
                <th className="p-4 font-medium">Zaxira</th>
                <th className="p-4 font-medium">Status</th>
                <th className="p-4 font-medium">Amallar</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {filtered.map((p) => (
                <tr key={p.id} className="hover:bg-slate-800/30 transition-colors">
                  <td className="p-4">
                    <div className="font-medium text-white">{p.name}</div>
                    {p.description && <div className="text-xs text-slate-400 mt-0.5 truncate max-w-xs">{p.description}</div>}
                  </td>
                  <td className="p-4 text-slate-400 font-mono text-xs">{p.sku || '-'}</td>
                  <td className="p-4 text-white font-medium">{Number(p.price || 0).toLocaleString()} UZS</td>
                  <td className="p-4">
                    <span className={`font-medium ${p.stock > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {p.stock || 0} dona
                    </span>
                  </td>
                  <td className="p-4">
                    {p.is_active !== false ? (
                      <span className="px-2 py-1 rounded-full text-xs bg-emerald-500/20 text-emerald-400 font-medium flex items-center gap-1 w-fit">
                        <CheckCircle2 className="w-3 h-3" /> Faol
                      </span>
                    ) : (
                      <span className="px-2 py-1 rounded-full text-xs bg-red-500/20 text-red-400 font-medium flex items-center gap-1 w-fit">
                        <AlertCircle className="w-3 h-3" /> Nofaol
                      </span>
                    )}
                  </td>
                  <td className="p-4">
                    <button
                      onClick={() => handleDelete(p.id)}
                      className="p-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add Product Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-lg glass-panel rounded-2xl p-6 border border-slate-700 shadow-2xl">
            <h3 className="text-lg font-bold text-white mb-4">Yangi Mahsulot Qo&apos;shish</h3>

            <div className="space-y-3">
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Mahsulot nomi *</label>
                <input
                  value={newProd.name}
                  onChange={(e) => setNewProd({ ...newProd, name: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-800/50 border border-slate-700 text-white text-sm focus:outline-none focus:border-indigo-500"
                  placeholder="Nike Air Max 270"
                />
              </div>

              <div>
                <label className="text-xs text-slate-400 mb-1 block">Tavsif</label>
                <textarea
                  value={newProd.description}
                  onChange={(e) => setNewProd({ ...newProd, description: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-800/50 border border-slate-700 text-white text-sm focus:outline-none focus:border-indigo-500 resize-none"
                  rows={2}
                  placeholder="Mahsulot haqida qisqacha..."
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">Narx (UZS) *</label>
                  <input
                    type="number"
                    value={newProd.price}
                    onChange={(e) => setNewProd({ ...newProd, price: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-800/50 border border-slate-700 text-white text-sm focus:outline-none focus:border-indigo-500"
                    placeholder="450000"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">Zaxira (dona)</label>
                  <input
                    type="number"
                    value={newProd.stock}
                    onChange={(e) => setNewProd({ ...newProd, stock: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-800/50 border border-slate-700 text-white text-sm focus:outline-none focus:border-indigo-500"
                    placeholder="10"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs text-slate-400 mb-1 block">SKU kod</label>
                <input
                  value={newProd.sku}
                  onChange={(e) => setNewProd({ ...newProd, sku: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-800/50 border border-slate-700 text-white text-sm focus:outline-none focus:border-indigo-500"
                  placeholder="NK-AIR-270"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowAddModal(false)}
                className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium text-sm transition-all border border-slate-700"
              >
                Bekor qilish
              </button>
              <button
                onClick={handleAddProduct}
                disabled={saving || !newProd.name || !newProd.price}
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
