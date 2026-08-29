'use client';

import React, { useState, useEffect } from 'react';
import { Plus, Search, ShoppingBag, Trash2, Edit3, CheckCircle2, AlertCircle, Loader2, PackageOpen, RefreshCw, Eye, X, Tag } from 'lucide-react';
import { apiGet, apiPost, apiPut, apiDelete } from '@/lib/api';

export default function ProductsCatalog() {
  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  
  // Add / Edit Modal State
  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    category_id: '',
    price: '',
    stock: '',
    sku: '',
    description: '',
    image_url: '',
    is_active: true
  });
  const [isSkuManuallyEdited, setIsSkuManuallyEdited] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async (showSpinner = true) => {
    try {
      if (showSpinner) setLoading(true);
      const [prodsRes, catsRes] = await Promise.all([
        apiGet('/products'),
        apiGet('/products/categories'),
      ]);
      setProducts(prodsRes.data || []);
      setCategories(catsRes.data || []);
    } catch (err: any) {
      setError(err.message || 'Xatolik yuz berdi');
    } finally {
      if (showSpinner) setLoading(false);
    }
  };

  // Helper to generate SKU automatically from product name
  const generateSkuFromName = (name: string) => {
    const clean = name.replace(/[^\w\s]/gi, '').trim().toUpperCase();
    const parts = clean.split(/\s+/);
    if (!parts || parts.length === 0 || !parts[0]) return '';
    let prefix = '';
    if (parts.length === 1) {
      prefix = parts[0].slice(0, 6);
    } else {
      prefix = parts.slice(0, 3).map(p => p.slice(0, 4)).join('-');
    }
    const rand = Math.floor(1000 + Math.random() * 9000);
    return `${prefix}-${rand}`;
  };

  const handleNameChange = (nameVal: string) => {
    if (!editingProduct && !isSkuManuallyEdited) {
      // Auto-generate SKU for new product if user hasn't typed custom SKU
      const autoSku = nameVal ? generateSkuFromName(nameVal) : '';
      setFormData(prev => ({ ...prev, name: nameVal, sku: autoSku }));
    } else {
      setFormData(prev => ({ ...prev, name: nameVal }));
    }
  };

  const openAddModal = () => {
    setEditingProduct(null);
    setFormData({
      name: '',
      category_id: '',
      price: '',
      stock: '10',
      sku: '',
      description: '',
      image_url: '',
      is_active: true
    });
    setIsSkuManuallyEdited(false);
    setError('');
    setShowModal(true);
  };

  const openEditModal = (p: any) => {
    setEditingProduct(p);
    setFormData({
      name: p.name || '',
      category_id: p.category_id || '',
      price: String(p.price || ''),
      stock: String(p.stock ?? 0),
      sku: p.sku || '',
      description: p.description || '',
      image_url: p.image_url || '',
      is_active: p.is_active !== false
    });
    setIsSkuManuallyEdited(true);
    setError('');
    setShowModal(true);
  };

  const handleSaveProduct = async () => {
    if (!formData.name.trim() || !formData.price) {
      setError("Iltimos, mahsulot nomi va narxini kiriting!");
      return;
    }

    setSaving(true);
    setError('');
    try {
      if (editingProduct) {
        // Update product
        await apiPut(`/products/${editingProduct.id}`, {
          name: formData.name.trim(),
          category_id: formData.category_id || null,
          price: parseFloat(formData.price),
          stock: parseInt(formData.stock || '0'),
          sku: formData.sku.trim() || undefined,
          description: formData.description.trim() || null,
          image_url: formData.image_url.trim() || null,
          is_active: formData.is_active
        });
        setSuccess("Mahsulot muvaffaqiyatli tahrirlandi!");
      } else {
        // Create new product
        await apiPost('/products', {
          name: formData.name.trim(),
          category_id: formData.category_id || undefined,
          price: parseFloat(formData.price),
          stock: parseInt(formData.stock || '0'),
          sku: formData.sku.trim() || undefined,
          description: formData.description.trim() || undefined,
          image_url: formData.image_url.trim() || undefined,
          currency: 'UZS',
        });
        setSuccess("Yangi mahsulot qo'shildi!");
      }

      setShowModal(false);
      setTimeout(() => setSuccess(''), 3000);
      await loadData(false);
    } catch (err: any) {
      setError(err.message || 'Xatolik yuz berdi');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`"${name}" mahsulotini o'chirishni tasdiqlaysizmi?`)) return;
    try {
      await apiDelete(`/products/${id}`);
      setSuccess("Mahsulot o'chirildi.");
      setTimeout(() => setSuccess(''), 3000);
      await loadData(false);
    } catch (err: any) {
      setError(err.message || "O'chirishda xatolik");
    }
  };

  const filtered = products.filter(p => {
    const matchesSearch = p.name?.toLowerCase().includes(search.toLowerCase()) || p.sku?.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = !selectedCategory || p.category_id === selectedCategory;
    return matchesSearch && matchesCategory;
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
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <ShoppingBag className="w-5 h-5 text-indigo-400" /> Mahsulotlar Katalogi
          </h2>
          <p className="text-xs text-slate-400 mt-1">Telegram AI sotuvchi muloqotda ushbu mahsulotlarni tavsiya qiladi va buyurtma oladi.</p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => loadData(false)}
            className="p-2.5 rounded-xl bg-slate-800/60 border border-slate-700 text-slate-300 hover:text-white transition-colors"
            title="Yangilash"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={openAddModal}
            className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition-all shadow-lg shadow-indigo-600/30 flex items-center gap-2"
          >
            <Plus className="w-4 h-4" /> Yangi Mahsulot Qo&apos;shish
          </button>
        </div>
      </div>

      {success && (
        <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-medium flex items-center gap-2 shadow-sm">
          <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {error && (
        <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-medium flex items-center gap-2 shadow-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Search and Category Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-3 rounded-xl bg-slate-800/50 border border-slate-700 text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 transition-colors text-sm"
            placeholder="Mahsulot nomi yoki SKU bo'yicha qidirish..."
          />
        </div>

        {categories.length > 0 && (
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-4 py-3 rounded-xl bg-slate-800/50 border border-slate-700 text-white text-xs focus:outline-none focus:border-indigo-500"
          >
            <option value="">Barcha kategoriyalar</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        )}
      </div>

      {/* Products Table */}
      {filtered.length === 0 ? (
        <div className="glass-panel p-12 rounded-2xl border border-slate-800 text-center">
          <PackageOpen className="w-16 h-16 text-slate-600 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-white mb-2">Mahsulotlar topilmadi</h3>
          <p className="text-sm text-slate-400 mb-4">Katalogingizga yangi mahsulot qo&apos;shing yoki qidiruv so&apos;rovini o&apos;zgartiring.</p>
          <button
            onClick={openAddModal}
            className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs transition-all shadow-md"
          >
            <Plus className="w-4 h-4 inline mr-1" /> Birinchi mahsulotni qo&apos;shing
          </button>
        </div>
      ) : (
        <div className="glass-panel rounded-2xl border border-slate-800 overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-400 bg-slate-900/60 border-b border-slate-800">
                  <th className="p-4 font-semibold">Mahsulot</th>
                  <th className="p-4 font-semibold">SKU Kod</th>
                  <th className="p-4 font-semibold">Narx</th>
                  <th className="p-4 font-semibold">Zaxira</th>
                  <th className="p-4 font-semibold">Holat</th>
                  <th className="p-4 font-semibold text-center">Amallar</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {filtered.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        {p.image_url ? (
                          <img
                            src={p.image_url}
                            alt={p.name}
                            className="w-10 h-10 rounded-xl object-cover border border-slate-700 bg-slate-800"
                            onError={(e: any) => { e.target.style.display = 'none'; }}
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 font-bold text-xs">
                            {(p.name || 'M')[0]}
                          </div>
                        )}
                        <div>
                          <div className="font-semibold text-white">{p.name}</div>
                          {p.description && <div className="text-xs text-slate-400 mt-0.5 truncate max-w-xs">{p.description}</div>}
                        </div>
                      </div>
                    </td>
                    <td className="p-4">
                      <span className="px-2 py-1 rounded-md bg-slate-800 border border-slate-700 text-indigo-300 font-mono text-xs">
                        {p.sku || '-'}
                      </span>
                    </td>
                    <td className="p-4 text-emerald-400 font-bold whitespace-nowrap">
                      {Number(p.price || 0).toLocaleString()} UZS
                    </td>
                    <td className="p-4">
                      <span className={`font-semibold text-xs px-2.5 py-1 rounded-lg ${
                        p.stock > 0 ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'
                      }`}>
                        {p.stock || 0} dona
                      </span>
                    </td>
                    <td className="p-4">
                      {p.is_active !== false ? (
                        <span className="px-2.5 py-1 rounded-full text-[11px] bg-emerald-500/20 text-emerald-300 font-semibold flex items-center gap-1 w-fit border border-emerald-500/30">
                          <CheckCircle2 className="w-3 h-3" /> Faol
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 rounded-full text-[11px] bg-red-500/20 text-red-300 font-semibold flex items-center gap-1 w-fit border border-red-500/30">
                          <AlertCircle className="w-3 h-3" /> Nofaol
                        </span>
                      )}
                    </td>
                    <td className="p-4">
                      <div className="flex items-center justify-center gap-2">
                        {/* Edit Button */}
                        <button
                          onClick={() => openEditModal(p)}
                          className="p-2 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 transition-colors"
                          title="Tahrirlash"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        {/* Delete Button */}
                        <button
                          onClick={() => handleDelete(p.id, p.name)}
                          className="p-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 transition-colors"
                          title="O'chirish"
                        >
                          <Trash2 className="w-4 h-4" />
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

      {/* Add / Edit Product Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-lg glass-panel rounded-2xl p-6 border border-slate-700 shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <ShoppingBag className="w-5 h-5 text-indigo-400" />
                {editingProduct ? 'Mahsulotni Tahrirlash' : 'Yangi Mahsulot Qo\'shish'}
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {error && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="space-y-3.5 text-xs">
              {/* Product Name */}
              <div>
                <label className="text-slate-300 font-semibold mb-1 block">Mahsulot nomi *</label>
                <input
                  value={formData.name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800/60 border border-slate-700 text-white focus:outline-none focus:border-indigo-500 text-sm"
                  placeholder="Masalan: Nike Air Jordan 4"
                />
              </div>

              {/* SKU code (Auto-generated from name or custom edited) */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-slate-300 font-semibold block">SKU Kod (Unikal identifikator)</label>
                  {!editingProduct && !isSkuManuallyEdited && formData.sku && (
                    <span className="text-[10px] text-indigo-400">✨ Avtomatik yaratildi</span>
                  )}
                </div>
                <input
                  value={formData.sku}
                  onChange={(e) => {
                    setIsSkuManuallyEdited(true);
                    setFormData({ ...formData, sku: e.target.value.toUpperCase() });
                  }}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800/60 border border-slate-700 text-indigo-300 font-mono focus:outline-none focus:border-indigo-500"
                  placeholder="NIKE-AIR-4-8921"
                />
                <p className="text-[10px] text-slate-500 mt-1">Mahsulot nomidan avtomatik olinadi, xohlasangiz o&apos;zingiz o&apos;zgartirishingiz mumkin.</p>
              </div>

              {/* Price & Stock */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-300 font-semibold mb-1 block">Narxi (UZS) *</label>
                  <input
                    type="number"
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800/60 border border-slate-700 text-white focus:outline-none focus:border-indigo-500 font-bold"
                    placeholder="450000"
                  />
                </div>
                <div>
                  <label className="text-slate-300 font-semibold mb-1 block">Zaxira (dona)</label>
                  <input
                    type="number"
                    value={formData.stock}
                    onChange={(e) => setFormData({ ...formData, stock: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800/60 border border-slate-700 text-white focus:outline-none focus:border-indigo-500"
                    placeholder="10"
                  />
                </div>
              </div>

              {/* Category */}
              {categories.length > 0 && (
                <div>
                  <label className="text-slate-300 font-semibold mb-1 block">Kategoriya</label>
                  <select
                    value={formData.category_id}
                    onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800/60 border border-slate-700 text-white focus:outline-none focus:border-indigo-500"
                  >
                    <option value="">Kategoriyasiz</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Description */}
              <div>
                <label className="text-slate-300 font-semibold mb-1 block">Tavsif (AI mijozga qanday tushuntirsin?)</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800/60 border border-slate-700 text-white focus:outline-none focus:border-indigo-500 resize-none"
                  rows={2}
                  placeholder="Materiali, rangi, xususiyatlari..."
                />
              </div>

              {/* Image URL */}
              <div>
                <label className="text-slate-300 font-semibold mb-1 block">Rasm URL havolasi (Ixtiyoriy)</label>
                <input
                  value={formData.image_url}
                  onChange={(e) => setFormData({ ...formData, image_url: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800/60 border border-slate-700 text-white focus:outline-none focus:border-indigo-500"
                  placeholder="https://example.com/rasm.jpg"
                />
              </div>

              {/* Active Toggle (When editing) */}
              {editingProduct && (
                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="checkbox"
                    id="is_active_toggle"
                    checked={formData.is_active}
                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                    className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
                  />
                  <label htmlFor="is_active_toggle" className="text-slate-300 font-medium cursor-pointer">
                    Mahsulot sotuvda faol (AI mijozlarga taklif qilsin)
                  </label>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs transition-colors"
              >
                Bekor qilish
              </button>
              <button
                type="button"
                onClick={handleSaveProduct}
                disabled={saving || !formData.name.trim() || !formData.price}
                className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs transition-all shadow-lg shadow-indigo-600/30 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                {editingProduct ? 'Saqlash' : 'Qo\'shish'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

