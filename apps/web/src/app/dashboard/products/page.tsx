'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Plus, Search, ShoppingBag, Trash2, Edit3, CheckCircle2, AlertCircle,
  Loader2, PackageOpen, RefreshCw, Eye, X, Tag, Upload, Film, Image as ImageIcon,
  PlayCircle, Check, AlertTriangle
} from 'lucide-react';
import { apiGet, apiPost, apiPut, apiDelete, uploadFileWithProgress, getFileUrl } from '@/lib/api';

export default function ProductsCatalog() {
  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [subInfo, setSubInfo] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  
  // Add / Edit Modal State
  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // View / Preview Modal State
  const [viewingProduct, setViewingProduct] = useState<any | null>(null);

  // Form State
  const [formData, setFormData] = useState<{
    name: string;
    category_id: string;
    price: string;
    stock: string;
    sku: string;
    description: string;
    image_url: string;
    media: any[];
    is_active: boolean;
  }>({
    name: '',
    category_id: '',
    price: '',
    stock: '',
    sku: '',
    description: '',
    image_url: '',
    media: [],
    is_active: true
  });
  const [isSkuManuallyEdited, setIsSkuManuallyEdited] = useState(false);

  // Upload progress state
  const [uploadingFiles, setUploadingFiles] = useState<{ name: string; percent: number }[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async (showSpinner = true) => {
    try {
      if (showSpinner) setLoading(true);
      const [prodsRes, catsRes, subRes] = await Promise.all([
        apiGet('/products'),
        apiGet('/products/categories'),
        apiGet('/subscriptions/current').catch(() => null),
      ]);
      setProducts(prodsRes.data || []);
      setCategories(catsRes.data || []);
      if (subRes?.data) {
        setSubInfo(subRes.data);
      }
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
      media: [],
      is_active: true
    });
    setUploadingFiles([]);
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
      media: Array.isArray(p.media) ? [...p.media] : [],
      is_active: p.is_active !== false
    });
    setUploadingFiles([]);
    setIsSkuManuallyEdited(true);
    setError('');
    setShowModal(true);
  };

  // Multiple File Upload Handler with Progress Bar
  const handleFilesSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const maxFileSizeMb = subInfo?.usage?.max_file_size_mb || 35;
    const maxMediaPerProduct = subInfo?.usage?.max_media_per_product || 10;
    const maxFileSizeBytes = maxFileSizeMb * 1024 * 1024;

    const fileList = Array.from(files);

    if (formData.media.length + fileList.length > maxMediaPerProduct) {
      setError(`Sizning tarifingizda bitta mahsulotga ko'pi bilan ${maxMediaPerProduct} ta media fayl yuklash mumkin. Ko'proq joy uchun tarifni yangilang!`);
      return;
    }

    setError('');

    for (const file of fileList) {
      if (file.size > maxFileSizeBytes) {
        setError(`"${file.name}" faylining hajmi (${(file.size / (1024 * 1024)).toFixed(1)} MB) tarifingiz limitidan (${maxFileSizeMb} MB) oshib ketdi!`);
        continue;
      }

      // Add to uploading list
      setUploadingFiles(prev => [...prev, { name: file.name, percent: 0 }]);

      try {
        const res = await uploadFileWithProgress(
          '/uploads/media',
          file,
          (percent) => {
            setUploadingFiles(prev =>
              prev.map(item => item.name === file.name ? { ...item, percent } : item)
            );
          }
        );

        if (res.success && res.data) {
          const uploadedItem = res.data;
          setFormData(prev => {
            const nextMedia = [...prev.media, uploadedItem];
            let nextImageUrl = prev.image_url;
            if (!nextImageUrl && uploadedItem.type === 'image') {
              nextImageUrl = uploadedItem.url;
            }
            return {
              ...prev,
              media: nextMedia,
              image_url: nextImageUrl
            };
          });
        }
      } catch (uploadErr: any) {
        setError(uploadErr.message || `"${file.name}" yuklanmadi`);
      } finally {
        // Remove from progress after small delay
        setTimeout(() => {
          setUploadingFiles(prev => prev.filter(item => item.name !== file.name));
        }, 500);
      }
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeMedia = (index: number) => {
    setFormData(prev => {
      const updatedMedia = prev.media.filter((_, i) => i !== index);
      let updatedImageUrl = prev.image_url;
      // If the removed item was the primary image_url, reassign to first remaining image
      if (prev.media[index]?.url === prev.image_url) {
        const firstImg = updatedMedia.find(m => m.type === 'image');
        updatedImageUrl = firstImg ? firstImg.url : '';
      }
      return {
        ...prev,
        media: updatedMedia,
        image_url: updatedImageUrl
      };
    });
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
          media: formData.media,
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
          media: formData.media,
          currency: 'UZS',
        });
        setSuccess("Yangi mahsulot rasm va videolari bilan qo'shildi!");
      }

      setShowModal(false);
      setTimeout(() => setSuccess(''), 4000);
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

  const maxFileSizeMb = subInfo?.usage?.max_file_size_mb || 35;
  const maxMediaCount = subInfo?.usage?.max_media_per_product || 10;

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
          <p className="text-xs text-slate-400 mt-1">
            Mahsulotlarga rasm va videolarni yuklang. Telegram AI sotuvchi ularni mijozlarga to&apos;g&apos;ridan-to&apos;g&apos;ri yuboradi.
          </p>
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
          <p className="text-sm text-slate-400 mb-4">Katalogingizga rasm va videolari bilan birinchi mahsulotni qo&apos;shing.</p>
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
                  <th className="p-4 font-semibold">Media (Foto/Video)</th>
                  <th className="p-4 font-semibold">SKU Kod</th>
                  <th className="p-4 font-semibold">Narx</th>
                  <th className="p-4 font-semibold">Zaxira</th>
                  <th className="p-4 font-semibold">Holat</th>
                  <th className="p-4 font-semibold text-center">Amallar</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {filtered.map((p) => {
                  const mediaList = Array.isArray(p.media) ? p.media : [];
                  const imageCount = mediaList.filter((m: any) => m.type === 'image').length + (p.image_url && !mediaList.some((m: any) => m.url === p.image_url) ? 1 : 0);
                  const videoCount = mediaList.filter((m: any) => m.type === 'video').length;

                  // Primary thumbnail URL
                  const primaryThumb = p.image_url ? getFileUrl(p.image_url) : (mediaList.find((m: any) => m.type === 'image')?.url ? getFileUrl(mediaList.find((m: any) => m.type === 'image')?.url) : null);

                  return (
                    <tr key={p.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          {primaryThumb ? (
                            <img
                              src={primaryThumb}
                              alt={p.name}
                              className="w-12 h-12 rounded-xl object-cover border border-slate-700 bg-slate-800 flex-shrink-0 cursor-pointer hover:opacity-90"
                              onClick={() => setViewingProduct(p)}
                              onError={(e: any) => { e.target.style.display = 'none'; }}
                            />
                          ) : (
                            <div className="w-12 h-12 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 font-bold text-sm flex-shrink-0">
                              {(p.name || 'M')[0]}
                            </div>
                          )}
                          <div>
                            <div
                              onClick={() => setViewingProduct(p)}
                              className="font-semibold text-white hover:text-indigo-400 cursor-pointer transition-colors"
                            >
                              {p.name}
                            </div>
                            {p.description && <div className="text-xs text-slate-400 mt-0.5 truncate max-w-xs">{p.description}</div>}
                          </div>
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {imageCount > 0 && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-cyan-500/10 text-cyan-400 text-xs border border-cyan-500/20 font-medium">
                              <ImageIcon className="w-3 h-3" /> {imageCount} rasm
                            </span>
                          )}
                          {videoCount > 0 && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-purple-500/10 text-purple-400 text-xs border border-purple-500/20 font-medium animate-pulse">
                              <Film className="w-3 h-3" /> {videoCount} video
                            </span>
                          )}
                          {imageCount === 0 && videoCount === 0 && (
                            <span className="text-xs text-slate-500 italic">Media yo&apos;q</span>
                          )}
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
                          {/* Preview Button */}
                          <button
                            onClick={() => setViewingProduct(p)}
                            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
                            title="Batafsil ko'rish (Rasm va Video pleyer)"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
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
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add / Edit Product Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="w-full max-w-2xl glass-panel rounded-2xl p-6 border border-slate-700 shadow-2xl space-y-4 my-8 max-h-[90vh] overflow-y-auto">
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

            <div className="space-y-4 text-xs">
              {/* Product Name */}
              <div>
                <label className="text-slate-300 font-semibold mb-1 block">Mahsulot nomi *</label>
                <input
                  value={formData.name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800/60 border border-slate-700 text-white focus:outline-none focus:border-indigo-500 text-sm"
                  placeholder="Masalan: Nike Air Jordan 4 Retro"
                />
              </div>

              {/* SKU code (Auto-generated from name or custom edited) */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-slate-300 font-semibold block">SKU Kod (Unikal identifikator)</label>
                  {!editingProduct && !isSkuManuallyEdited && formData.sku && (
                    <span className="text-[10px] text-indigo-400 font-medium">✨ Avtomatik yaratildi</span>
                  )}
                </div>
                <input
                  value={formData.sku}
                  onChange={(e) => {
                    setIsSkuManuallyEdited(true);
                    setFormData({ ...formData, sku: e.target.value.toUpperCase() });
                  }}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800/60 border border-slate-700 text-indigo-300 font-mono focus:outline-none focus:border-indigo-500"
                  placeholder="NIK-AIR-JOR-8921"
                />
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
                  placeholder="Materiali, rangi, o'lchamlari va afzalliklari..."
                />
              </div>

              {/* MEDIA UPLOAD SECTION (Photos and playable Videos) */}
              <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-3">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-1">
                  <div>
                    <label className="text-slate-200 font-bold flex items-center gap-1.5 text-xs">
                      <Upload className="w-4 h-4 text-indigo-400" /> Rasm va Video yuklash
                    </label>
                    <p className="text-[11px] text-slate-400">
                      Yuklangan media fayllar Telegram botda mijozlarga to&apos;g&apos;ridan-to&apos;g&apos;ri ko&apos;rsatiladi.
                    </p>
                  </div>
                  <div className="text-[10px] text-indigo-300 bg-indigo-950/60 border border-indigo-500/30 px-2 py-1 rounded-md">
                    Limit: {maxFileSizeMb} MB gacha | Max: {maxMediaCount} ta
                  </div>
                </div>

                {/* Upload Button / Dropzone */}
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept="image/*,video/*"
                  onChange={handleFilesSelected}
                  className="hidden"
                />

                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-slate-700 hover:border-indigo-500 bg-slate-800/40 hover:bg-slate-800/70 rounded-xl p-5 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-2 group"
                >
                  <div className="w-10 h-10 rounded-full bg-indigo-600/20 text-indigo-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Upload className="w-5 h-5" />
                  </div>
                  <div className="text-xs text-slate-300 font-semibold">
                    Rasm yoki Video tanlash uchun bu yerga bosing
                  </div>
                  <p className="text-[10px] text-slate-500">
                    JPG, PNG, WEBP, MP4, MOV, WEBM qo&apos;llab-quvvatlanadi (Bir nechta tanlash mumkin)
                  </p>
                </div>

                {/* Active Uploading Files Progress Bars */}
                {uploadingFiles.length > 0 && (
                  <div className="space-y-2 pt-2 border-t border-slate-800">
                    {uploadingFiles.map((uf, idx) => (
                      <div key={idx} className="p-2.5 rounded-lg bg-slate-800/70 border border-slate-700 space-y-1.5">
                        <div className="flex justify-between items-center text-[11px]">
                          <span className="text-white font-medium truncate max-w-[200px] flex items-center gap-1.5">
                            <Loader2 className="w-3 h-3 text-indigo-400 animate-spin" /> {uf.name}
                          </span>
                          <span className="text-indigo-400 font-bold">{uf.percent}%</span>
                        </div>
                        <div className="w-full h-1.5 bg-slate-700 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all duration-300"
                            style={{ width: `${uf.percent}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Uploaded Media Previews (Images + Videos) */}
                {formData.media.length > 0 && (
                  <div className="space-y-2 pt-2 border-t border-slate-800">
                    <div className="text-[11px] font-semibold text-slate-300">
                      Yuklangan fayllar ({formData.media.length} ta):
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {formData.media.map((m: any, idx: number) => {
                        const isVideo = m.type === 'video';
                        const fullUrl = getFileUrl(m.url);
                        const isPrimary = formData.image_url === m.url;

                        return (
                          <div
                            key={idx}
                            className="relative group rounded-xl overflow-hidden border border-slate-700 bg-slate-800/80 flex flex-col justify-between"
                          >
                            {isVideo ? (
                              <div className="relative w-full h-28 bg-black flex items-center justify-center">
                                <video
                                  src={fullUrl}
                                  className="w-full h-full object-cover"
                                  controls
                                  preload="metadata"
                                />
                                <span className="absolute top-1 left-1 bg-purple-600/90 text-white text-[9px] px-1.5 py-0.5 rounded font-bold flex items-center gap-1">
                                  <Film className="w-2.5 h-2.5" /> Video
                                </span>
                              </div>
                            ) : (
                              <div className="relative w-full h-28 bg-slate-900">
                                <img
                                  src={fullUrl}
                                  alt={m.filename || 'Rasm'}
                                  className="w-full h-full object-cover"
                                  onError={(e: any) => { e.target.style.display = 'none'; }}
                                />
                                {isPrimary && (
                                  <span className="absolute top-1 left-1 bg-emerald-600/90 text-white text-[9px] px-1.5 py-0.5 rounded font-bold flex items-center gap-1">
                                    <Check className="w-2.5 h-2.5" /> Asosiy
                                  </span>
                                )}
                              </div>
                            )}

                            <div className="p-2 flex items-center justify-between gap-1 text-[10px]">
                              <span className="truncate text-slate-300 font-medium">
                                {m.filename || (isVideo ? 'Video' : 'Rasm')}
                              </span>
                              <button
                                type="button"
                                onClick={() => removeMedia(idx)}
                                className="p-1 rounded-md bg-red-500/20 hover:bg-red-500 text-red-300 hover:text-white transition-colors"
                                title="O'chirish"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
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
                disabled={saving || !formData.name.trim() || !formData.price || uploadingFiles.length > 0}
                className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs transition-all shadow-lg shadow-indigo-600/30 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                {editingProduct ? 'Saqlash' : 'Mahsulotni Qo\'shish'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Product Details & Video Player Modal */}
      {viewingProduct && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="w-full max-w-2xl glass-panel rounded-2xl p-6 border border-slate-700 shadow-2xl space-y-5 my-8 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-start border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <ShoppingBag className="w-5 h-5 text-indigo-400" />
                  {viewingProduct.name}
                </h3>
                <span className="text-xs text-indigo-300 font-mono mt-0.5 block">
                  SKU: {viewingProduct.sku || '-'}
                </span>
              </div>
              <button
                onClick={() => setViewingProduct(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Media Gallery (Playable Video + High-Res Photos) */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <PlayCircle className="w-4 h-4 text-purple-400" /> Mahsulot Video va Rasmlari
              </h4>

              {(!viewingProduct.media || viewingProduct.media.length === 0) && !viewingProduct.image_url ? (
                <div className="p-6 text-center text-xs text-slate-500 bg-slate-900/50 rounded-xl border border-slate-800">
                  Ushbu mahsulotga hali rasm yoki video yuklanmagan.
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Videos section */}
                  {Array.isArray(viewingProduct.media) && viewingProduct.media.filter((m: any) => m.type === 'video').map((vid: any, vIdx: number) => (
                    <div key={vIdx} className="rounded-xl overflow-hidden border border-purple-500/30 bg-black shadow-xl">
                      <div className="p-2 bg-purple-950/60 border-b border-purple-900/40 text-[11px] font-semibold text-purple-300 flex items-center gap-1.5">
                        <Film className="w-3.5 h-3.5" /> Video {vIdx + 1}: {vid.filename || 'Mahsulot videosi'}
                      </div>
                      <video
                        src={getFileUrl(vid.url)}
                        controls
                        controlsList="nodownload"
                        className="w-full max-h-80 object-contain bg-black"
                        preload="metadata"
                      />
                    </div>
                  ))}

                  {/* Images section */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {/* Primary Image */}
                    {viewingProduct.image_url && (
                      <div className="relative rounded-xl overflow-hidden border border-slate-700 bg-slate-900 h-36">
                        <img
                          src={getFileUrl(viewingProduct.image_url)}
                          alt={viewingProduct.name}
                          className="w-full h-full object-cover"
                        />
                        <span className="absolute bottom-1 left-1 bg-black/70 text-white text-[9px] px-1.5 py-0.5 rounded">
                          Asosiy rasm
                        </span>
                      </div>
                    )}
                    {/* Additional Images from media */}
                    {Array.isArray(viewingProduct.media) && viewingProduct.media.filter((m: any) => m.type === 'image' && m.url !== viewingProduct.image_url).map((img: any, iIdx: number) => (
                      <div key={iIdx} className="relative rounded-xl overflow-hidden border border-slate-700 bg-slate-900 h-36">
                        <img
                          src={getFileUrl(img.url)}
                          alt={img.filename || viewingProduct.name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Product Details Specs */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2 text-xs">
              <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800">
                <span className="text-slate-400 block text-[11px]">Narxi:</span>
                <span className="text-base font-extrabold text-emerald-400 mt-0.5 block">
                  {Number(viewingProduct.price || 0).toLocaleString()} UZS
                </span>
              </div>
              <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800">
                <span className="text-slate-400 block text-[11px]">Mavjud zaxira:</span>
                <span className="text-base font-bold text-white mt-0.5 block">
                  {viewingProduct.stock || 0} dona
                </span>
              </div>
              <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800">
                <span className="text-slate-400 block text-[11px]">Holat:</span>
                <span className="text-sm font-bold text-emerald-400 mt-0.5 block">
                  {viewingProduct.is_active !== false ? '✅ Sotuvda faol' : '❌ Nofaol'}
                </span>
              </div>
            </div>

            {viewingProduct.description && (
              <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 text-xs">
                <span className="text-slate-400 block text-[11px] mb-1 font-semibold">Tavsif:</span>
                <p className="text-slate-200 leading-relaxed">{viewingProduct.description}</p>
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => {
                  const prod = viewingProduct;
                  setViewingProduct(null);
                  openEditModal(prod);
                }}
                className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition-all flex items-center justify-center gap-1.5 shadow-lg shadow-indigo-600/30"
              >
                <Edit3 className="w-4 h-4" /> Tahrirlash
              </button>
              <button
                onClick={() => setViewingProduct(null)}
                className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
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
