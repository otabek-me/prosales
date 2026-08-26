'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Sparkles, Check, ArrowRight, ArrowLeft, Bot, ShoppingBag, Sliders, MessageSquare, Rocket, Loader2 } from 'lucide-react';
import { apiGet, apiPut, apiPost } from '@/lib/api';

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Form State
  const [businessName, setBusinessName] = useState('');
  const [category, setCategory] = useState('Kiyim va Poyabzal');
  const [phone, setPhone] = useState('');
  const [botToken, setBotToken] = useState('');
  const [botConnected, setBotConnected] = useState(false);
  const [productName, setProductName] = useState('');
  const [productPrice, setProductPrice] = useState('');
  const [productSku, setProductSku] = useState('');
  const [botName, setBotName] = useState('AI Sotuvchi');
  const [botPersonality, setBotPersonality] = useState('Xushmuomala, professional va do\'stona sotuvchi.');

  useEffect(() => {
    // Load initial org profile
    apiGet('/organizations/current').then((res) => {
      if (res?.data) {
        if (res.data.name) setBusinessName(res.data.name);
        if (res.data.category) setCategory(res.data.category);
        if (res.data.phone) setPhone(res.data.phone);
      }
    }).catch(() => {});
  }, []);

  const stepsList = [
    'Biznes nomi',
    'Kategoriya',
    'Telefon',
    'Telegram Bot',
    'Mahsulot',
    'AI Sozlamalari',
    'Aktivlashtirish'
  ];

  const handleNext = async () => {
    setError('');
    setLoading(true);

    try {
      if (step === 1 || step === 2 || step === 3) {
        // Save Org Details
        await apiPut('/organizations/current', {
          name: businessName || 'Mening Do\'konim',
          category: category,
          phone: phone || undefined,
        }).catch(() => {});
      } else if (step === 4 && botToken.trim() && !botConnected) {
        // Try connecting bot
        try {
          await apiPost('/bots/connect', { bot_token: botToken.trim() });
          setBotConnected(true);
        } catch (e: any) {
          setError(e.message || 'Bot tokenini tekshirib qaytadan urinib ko\'ring yoki keyinroq ulashingiz mumkin.');
          setLoading(false);
          return;
        }
      } else if (step === 5 && productName.trim() && productPrice.trim()) {
        // Add first product
        await apiPost('/products', {
          name: productName.trim(),
          price: parseFloat(productPrice),
          stock: 10,
          sku: productSku.trim() || undefined,
          currency: 'UZS'
        }).catch(() => {});
      } else if (step === 6) {
        // Save AI settings
        await apiPut('/organizations/ai-settings', {
          bot_name: botName || 'AI Sotuvchi',
          personality: botPersonality || 'Professional sotuvchi'
        }).catch(() => {});
      }

      if (step < 7) {
        setStep(step + 1);
      } else {
        router.push('/dashboard');
      }
    } catch (err: any) {
      setError(err.message || 'Xatolik yuz berdi');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center p-6 relative">
      <div className="w-full max-w-3xl glass-panel rounded-2xl p-8 border border-slate-800 relative z-10 shadow-2xl">
        {/* Progress Bar Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-400 mb-2">
            <span>Boshlang&apos;ich Sozlash — Qadam {step} / 7</span>
            <span>{Math.round((step / 7) * 100)}%</span>
          </div>
          <div className="w-full bg-slate-900 h-2 rounded-full overflow-hidden">
            <div
              className="bg-gradient-to-r from-indigo-500 to-purple-500 h-full transition-all duration-300"
              style={{ width: `${(step / 7) * 100}%` }}
            ></div>
          </div>
          <div className="flex justify-between mt-3">
            {stepsList.map((sName, idx) => (
              <span
                key={idx}
                className={`text-[10px] font-medium hidden sm:block ${
                  idx + 1 <= step ? 'text-indigo-400 font-bold' : 'text-slate-600'
                }`}
              >
                {sName}
              </span>
            ))}
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs">
            {error}
          </div>
        )}

        {/* Step Content Render */}
        <div className="min-h-[280px]">
          {step === 1 && (
            <div className="space-y-4">
              <h2 className="text-xl font-bold text-white">1. Do&apos;kon yoki Biznesingiz nomini kiriting</h2>
              <p className="text-xs text-slate-400">Telegramdagi mijozlar AI yordamchisi do&apos;kon nomini shu tarzda tanib oladi.</p>
              <input
                type="text"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                placeholder="Masalan: Trendy Style Uzbek Store"
                className="w-full px-4 py-3 rounded-xl bg-slate-900 border border-slate-800 text-sm text-white focus:outline-none focus:border-indigo-500"
              />
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <h2 className="text-xl font-bold text-white">2. Biznes faoliyat turini tanlang</h2>
              <div className="grid grid-cols-2 gap-3">
                {['Kiyim va Poyabzal', 'Elektronika', 'Kosmetika va Parfumeriya', 'Aksessuarlar', 'Uy-ro\'zg\'or buyumlari', 'Xizmatlar / Boshqa'].map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setCategory(cat)}
                    className={`p-3 rounded-xl border text-xs font-semibold text-left transition-all ${
                      category === cat
                        ? 'bg-indigo-600/20 border-indigo-500 text-indigo-300'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <h2 className="text-xl font-bold text-white">3. Aloqa telefon raqami</h2>
              <p className="text-xs text-slate-400">Mijozlar buyurtmalari uchun admin aloqa raqami.</p>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+998 90 123 45 67"
                className="w-full px-4 py-3 rounded-xl bg-slate-900 border border-slate-800 text-sm text-white focus:outline-none focus:border-indigo-500"
              />
            </div>
          )}

          {step === 4 && (
            <div className="space-y-4">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <Bot className="w-5 h-5 text-indigo-400" /> 4. Telegram Bot Ulash
              </h2>
              <p className="text-xs text-slate-400">@BotFather orqali olingan API tokenni kiriting (ixtiyoriy, keyinroq ham ulashingiz mumkin).</p>
              <input
                type="text"
                value={botToken}
                onChange={(e) => setBotToken(e.target.value)}
                placeholder="7182930491:AAH829x_..."
                className="w-full px-4 py-3 rounded-xl bg-slate-900 border border-slate-800 text-xs font-mono text-indigo-300 focus:outline-none focus:border-indigo-500"
              />
              {botConnected && (
                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex items-center gap-2">
                  <Check className="w-4 h-4" /> Telegram Bot muvaffaqiyatli ulandi!
                </div>
              )}
            </div>
          )}

          {step === 5 && (
            <div className="space-y-4">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <ShoppingBag className="w-5 h-5 text-indigo-400" /> 5. Birinchi Mahsulotingizni Qo&apos;shing
              </h2>
              <p className="text-xs text-slate-400">AI botingiz tavsiya qilishi uchun birinchi mahsulotni kiriting (ixtiyoriy).</p>
              <div className="space-y-3">
                <input
                  type="text"
                  placeholder="Mahsulot nomi (masalan: Erkaklar krossovkasi)"
                  value={productName}
                  onChange={(e) => setProductName(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-sm text-white focus:outline-none focus:border-indigo-500"
                />
                <input
                  type="number"
                  placeholder="Narxi (UZS)"
                  value={productPrice}
                  onChange={(e) => setProductPrice(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-sm text-white focus:outline-none focus:border-indigo-500"
                />
                <input
                  type="text"
                  placeholder="SKU kod (ixtiyoriy)"
                  value={productSku}
                  onChange={(e) => setProductSku(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-sm text-white focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>
          )}

          {step === 6 && (
            <div className="space-y-4">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <Sliders className="w-5 h-5 text-indigo-400" /> 6. AI Sotuvchi Sozlamalari
              </h2>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">AI Sotuvchi Ismi</label>
                  <input
                    type="text"
                    value={botName}
                    onChange={(e) => setBotName(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-sm text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Xulq-atvori / Shaxsiyati</label>
                  <textarea
                    value={botPersonality}
                    onChange={(e) => setBotPersonality(e.target.value)}
                    rows={2}
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-sm text-white focus:outline-none focus:border-indigo-500 resize-none"
                  />
                </div>
              </div>
            </div>
          )}

          {step === 7 && (
            <div className="text-center py-6 space-y-4">
              <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/20">
                <Rocket className="w-8 h-8" />
              </div>
              <h2 className="text-2xl font-bold text-white">Hammasi Tayyor! 🎉</h2>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                Boshqaruv paneliga o&apos;tib, yangi buyurtmalarni qabul qilish va AI botni boshqarishni boshlashingiz mumkin.
              </p>
            </div>
          )}
        </div>

        {/* Footer Navigation Controls */}
        <div className="flex items-center justify-between pt-6 border-t border-slate-800/80 mt-6">
          <button
            type="button"
            onClick={() => setStep(Math.max(1, step - 1))}
            disabled={step === 1 || loading}
            className="px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white text-xs font-semibold disabled:opacity-40 flex items-center gap-1.5"
          >
            <ArrowLeft className="w-4 h-4" /> Orqaga
          </button>

          <button
            type="button"
            onClick={handleNext}
            disabled={loading}
            className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-semibold text-xs shadow-lg shadow-indigo-600/30 flex items-center gap-2 disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <span>{step === 7 ? "Boshqaruv paneliga o'tish" : "Keyingisi"}</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}