'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Store, Bell, Search, User, LogOut, MessageSquare, AlertTriangle,
  ShoppingBag, ShoppingCart, Users, Settings, ChevronDown, X, CheckCheck,
  Loader2, PackageOpen, LayoutDashboard, Sparkles
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { clearToken, apiGet, getOrgId } from '@/lib/api';

type SearchResults = {
  products: any[];
  orders: any[];
  customers: any[];
};

type NotificationItem = {
  type: string;
  title: string;
  body: string;
  unread: boolean;
  link: string;
  created_at?: string;
};

function SearchGroup({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
        {icon}{label}
      </div>
      {children}
    </div>
  );
}

function SearchItem({ title, sub, onClick }: { title: string; sub: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-slate-800/50 transition-colors text-left">
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium text-white truncate">{title}</div>
        <div className="text-xs text-slate-400 truncate">{sub}</div>
      </div>
    </button>
  );
}
export default function Navbar() {
  const router = useRouter();
  const [notificationCount, setNotificationCount] = useState(0);
  const [operatorAlert, setOperatorAlert] = useState(0);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResults>({ products: [], orders: [], customers: [] });
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifFilter, setNotifFilter] = useState<'all' | 'order' | 'operator'>('all');
  const [notifLoading, setNotifLoading] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [profile, setProfile] = useState<any>(null);
  const [orgName, setOrgName] = useState('');
  const searchRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchTimer = useRef<any>(null);

  const loadProfile = useCallback(async () => {
    try {
      const res = await apiGet('/auth/me');
      const data = res?.data || {};
      setProfile(data.user || null);
      const org = (data.organizations || []).find((o: any) => o.id === getOrgId()) || (data.organizations || [])[0];
      if (org) setOrgName(org.name || '');
    } catch {}
  }, []);

  const loadNotifications = useCallback(async () => {
    try {
      const res = await apiGet('/meta/notifications');
      const data = res?.data || { items: [], unread_count: 0 };
      setNotifications(data.items || []);
      setNotificationCount(data.unread_count || 0);
      const opReq = (data.items || []).filter((n: any) => n.type === 'operator_request' && n.unread).length;
      setOperatorAlert(opReq);
    } catch {}
  }, []);

  const handleLogout = () => { clearToken(); localStorage.removeItem('org_id'); router.push('/login'); };

  const initials = (() => {
    const name = profile?.full_name || profile?.email || 'U';
    const parts = name.split(' ').filter(Boolean);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return (name[0] || 'U').toUpperCase();
  })();

  useEffect(() => {
    loadProfile();
    loadNotifications();
    const timer = setInterval(() => { loadNotifications(); loadProfile(); }, 15000);
    return () => clearInterval(timer);
  }, [loadProfile, loadNotifications]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); setSearchOpen(true); searchInputRef.current?.focus(); }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (searchOpen && searchRef.current && !searchRef.current.contains(e.target as Node)) setSearchOpen(false);
      if (notifOpen && notifRef.current && !notifRef.current.contains(e.target as Node)) setNotifOpen(false);
      if (profileOpen && profileRef.current && !profileRef.current.contains(e.target as Node)) setProfileOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [searchOpen, notifOpen, profileOpen]);

  const doSearch = useCallback((q: string) => {
    setSearchQuery(q);
    if (!q.trim()) { setSearchResults({ products: [], orders: [], customers: [] }); return; }
    setSearching(true);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(async () => {
      try {
        const [pRes, oRes, cRes] = await Promise.allSettled([
          apiGet('/products?search=' + encodeURIComponent(q) + '&limit=5'),
          apiGet('/orders?search=' + encodeURIComponent(q) + '&limit=5'),
          apiGet('/customers?search=' + encodeURIComponent(q) + '&limit=5'),
        ]);
        setSearchResults({
          products: pRes.status === 'fulfilled' ? (pRes.value?.data?.items || pRes.value?.data || []) : [],
          orders: oRes.status === 'fulfilled' ? (oRes.value?.data?.items || oRes.value?.data || []) : [],
          customers: cRes.status === 'fulfilled' ? (cRes.value?.data?.items || cRes.value?.data || []) : [],
        });
      } catch {}
      setSearching(false);
    }, 300);
  }, []);

  return (
        <header className="sticky top-0 z-40 w-full h-16 border-b border-slate-800/60 bg-[#0a0d14]/80 backdrop-blur-xl px-6 flex items-center justify-between">
      {/* Left: brand + quick nav */}
      <div className="flex items-center gap-3">
        <Link href="/dashboard" className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-xl text-slate-300 hover:text-white hover:bg-slate-800/50 transition-colors group">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
            <Store className="w-4 h-4 text-white" />
          </div>
          <span className="font-semibold text-sm">ProSales</span>
          <span className="text-xs text-emerald-400 bg-emerald-500/10 px-1.5 py-0.25 rounded-full">Beta</span>
        </Link>
        <Link href="/dashboard/products" className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800/50 transition-colors" title="Mahsulotlar">
          <ShoppingBag className="w-4 h-4" />
        </Link>
        <Link href="/dashboard/orders" className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800/50 transition-colors" title="Buyurtmalar">
          <ShoppingCart className="w-4 h-4" />
        </Link>
        <Link href="/dashboard/customers" className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800/50 transition-colors" title="Mijdorlar">
          <Users className="w-4 h-4" />
        </Link>
      </div>
      {/* Right: search + actions */}
      <div className="flex items-center gap-2 ml-auto flex-shrink-0">
        {/* Windows 11 style compact search */}
        <button
          onClick={() => { setSearchOpen(true); setTimeout(() => searchInputRef.current?.focus(), 50); }}
          className="hidden sm:flex items-center gap-2 w-52 lg:w-64 h-9 px-3 rounded-lg bg-slate-800/40 border border-slate-700/60 text-slate-400 hover:bg-slate-800/70 hover:border-slate-600 focus-within:border-indigo-500/60 transition-all duration-200 flex-shrink-0"
          title="Qidirish (Ctrl+K)"
        >
          <Search className="w-4 h-4 flex-shrink-0 text-slate-500" />
          <span className="flex-1 text-left text-xs truncate">Mahsulot, buyurtma...</span>
          <kbd className="hidden lg:flex items-center px-1.5 py-0.5 rounded bg-slate-900/80 border border-slate-700 text-[10px] font-sans text-slate-500 flex-shrink-0">Ctrl K</kbd>
        </button>
        <button onClick={() => { setSearchOpen(true); setTimeout(() => searchInputRef.current?.focus(), 50); }} className="sm:hidden p-2 rounded-xl bg-slate-800/50 border border-slate-700/50 text-slate-300 hover:text-white transition-colors" title="Qidirish">
          <Search className="w-4 h-4" />
        </button>

        {searchOpen && (
          <div ref={searchRef} className="fixed inset-0 z-[100] flex items-start justify-center pt-20 bg-black/60 backdrop-blur-sm">
            <div className="w-full max-w-2xl mx-4 rounded-2xl bg-slate-900 border border-slate-700/60 shadow-2xl shadow-black/50 overflow-hidden animate-fade-in">
              <div className="flex items-center gap-3 p-4 border-b border-slate-800">
                <Search className="w-5 h-5 text-slate-500" />
                <input ref={searchInputRef} type="text" placeholder="Mahsulot, buyurtma, mijdor qidirish..." value={searchQuery} onChange={(e) => doSearch(e.target.value)} className="flex-1 bg-transparent text-white placeholder-slate-500 focus:outline-none text-base" autoFocus />
                <button onClick={() => setSearchOpen(false)} className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"><X className="w-4 h-4" /></button>
              </div>


              <div className="max-h-96 overflow-y-auto">
                {searching ? (<div className="p-6 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-indigo-400" /></div>
                ) : (searchResults.products.length + searchResults.orders.length + searchResults.customers.length === 0) ? (
                  <div className="p-8 text-center text-sm text-slate-500"><PackageOpen className="w-10 h-10 mx-auto mb-3 text-slate-600" />Hech narsa topilmadi</div>
                ) : (
                  <>
                    {searchResults.products.length > 0 && (
                      <SearchGroup icon={<ShoppingBag className="w-4 h-4" />} label="Mahsulotlar">
                        {searchResults.products.map((p: any) => (<SearchItem key={p.id} title={p.name} sub={p.sku + ' · ' + (p.price || 0) + ' UZS'} onClick={() => { setSearchOpen(false); router.push('/dashboard/products/' + p.id); }} />))}
                      </SearchGroup>
                    )}
                    {searchResults.orders.length > 0 && (
                      <SearchGroup icon={<ShoppingCart className="w-4 h-4" />} label="Buyurtmalar">
                        {searchResults.orders.map((o: any) => (<SearchItem key={o.id} title={o.id} sub={(o.customer_name || o.customer || '—') + ' · ' + (o.total || 0) + ' UZS'} onClick={() => { setSearchOpen(false); router.push('/dashboard/orders/' + o.id); }} />))}
                      </SearchGroup>
                    )}
                    {searchResults.customers.length > 0 && (
                      <SearchGroup icon={<User className="w-4 h-4" />} label="Mijdorlar">
                        {searchResults.customers.map((c: any) => (<SearchItem key={c.id} title={c.full_name || c.name || '—'} sub={c.phone || ''} onClick={() => { setSearchOpen(false); router.push('/dashboard/customers/' + c.id); }} />))}
                      </SearchGroup>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        )}
        <div className="relative" ref={notifRef}>
          <button onClick={() => { setNotifOpen((v: any) => !v); if (!notifOpen) { setNotifLoading(true); loadNotifications().finally(() => setNotifLoading(false)); } }} className="relative p-2 rounded-xl bg-slate-800/50 border border-slate-700/50 text-slate-300 hover:text-white transition-colors" title="Bildirishnomalar">
            <Bell className="w-4 h-4" />
            {notificationCount > 0 && (<span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center ring-2 ring-slate-900">{notificationCount > 99 ? '99+' : notificationCount}</span>)}
          </button>
          {notifOpen && (
            <div className="absolute right-0 top-12 z-50 w-80 sm:w-96 rounded-2xl bg-[#0f1219] border border-slate-800 shadow-xl shadow-black/60 overflow-hidden animate-fade-in flex flex-col">
              {/* Header */}
              <div className="p-3 border-b border-slate-800 flex items-center justify-between flex-shrink-0">
                <span className="text-sm font-bold text-white flex items-center gap-2"><Bell className="w-4 h-4 text-indigo-400" /> Bildirishnomalar</span>
                <div className="flex items-center gap-1">
                  <button onClick={() => { setNotifications((prev: any) => prev.map((n: any) => ({ ...n, unread: false }))); setNotificationCount(0); setOperatorAlert(0); }} className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-400 hover:bg-slate-800 transition-colors" title="Barchasini o'qilgan qilish"><CheckCheck className="w-4 h-4" /></button>
                  <button onClick={() => setNotifOpen(false)} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors" title="Yopish"><X className="w-4 h-4" /></button>
                </div>
              </div>
              {/* Filter row */}
              <div className="p-2 border-b border-slate-800 flex items-center gap-1.5 flex-shrink-0">
                {([['all', 'Barchasi'], ['order', 'Buyurtmalar'], ['operator', 'Operator so\u2018rovlari']] as const).map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => setNotifFilter(key)}
                    className={'px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors ' + (notifFilter === key ? 'bg-indigo-600/30 text-indigo-300 border border-indigo-500/40' : 'bg-slate-800/50 text-slate-400 border border-transparent hover:text-white hover:bg-slate-800')}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {/* List */}
              <div className="flex flex-col gap-1 max-h-96 overflow-y-auto p-2">
                {notifLoading && notifications.length === 0 ? (<div className="p-6 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-indigo-400" /></div>
                ) : notifications.length === 0 ? (<div className="p-8 text-center text-xs text-slate-500"><PackageOpen className="w-8 h-8 mx-auto mb-2 text-slate-600" />Hozircha bildirishnomalar yo&apos;q</div>
                ) : (
                  notifications
                    .filter((n: any) => notifFilter === 'all' || (notifFilter === 'operator' ? n.type === 'operator_request' : n.type === 'new_order'))
                    .map((n: any, i: number) => (
                      <Link key={i} href={n.link || '/dashboard/notifications'} onClick={() => setNotifOpen(false)} className={'flex items-start gap-3 p-3 rounded-xl hover:bg-slate-800/50 transition-colors border border-transparent ' + (n.unread ? 'bg-indigo-500/10 border-indigo-500/20' : '')}>
                        <span className="w-8 h-8 flex-shrink-0 flex items-center justify-center rounded-lg bg-slate-800 border border-slate-700/60">
                          {n.type === 'operator_request' ? <User className="w-4 h-4 text-amber-400" /> : n.type === 'new_order' ? <ShoppingCart className="w-4 h-4 text-emerald-400" /> : <Sparkles className="w-4 h-4 text-indigo-400" />}
                        </span>
                        <div className="min-w-0 flex-1 flex flex-col gap-1">
                          <div className="text-sm font-medium text-white flex items-center gap-2 min-w-0"><span className="truncate">{n.title}</span>{n.unread && <span className="w-2 h-2 rounded-full bg-indigo-400 shrink-0 flex-shrink-0" />}</div>
                          <div className="text-xs text-slate-400 leading-relaxed break-words line-clamp-2">{n.body}</div>
                        </div>
                      </Link>
                    ))
                )}
              </div>
              {/* Footer */}
              <div className="p-3 border-t border-slate-800 flex gap-2 flex-shrink-0">
                <Link href="/dashboard/inbox" onClick={() => setNotifOpen(false)} className="flex-1 text-center py-2 rounded-xl text-xs font-semibold bg-slate-800/60 hover:bg-slate-700 text-slate-300 transition-colors">Inbox</Link>
                <Link href="/dashboard/notifications" onClick={() => setNotifOpen(false)} className="flex-1 text-center py-2 rounded-xl text-xs font-semibold bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 transition-colors">Barchasini ko&apos;rish</Link>
              </div>
            </div>
          )}

        </div>
        <Link href="/dashboard/inbox" className="p-2 rounded-xl bg-slate-800/50 border border-slate-700/50 text-slate-300 hover:text-white relative transition-colors" title="Jonli xabarlar">
          <MessageSquare className="w-4 h-4" />
          {operatorAlert > 0 && (<span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-amber-400 ring-2 ring-slate-900 animate-ping" />)}
        </Link>
        <div className="relative" ref={profileRef}>
          <button onClick={() => { setProfileOpen((v: any) => !v); if (!profile) loadProfile(); }} className="flex items-center gap-2 pl-2 border-l border-slate-800 py-1.5 pr-1 rounded-xl hover:bg-slate-800/40 transition-colors" title="Profil">
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-purple-500 to-indigo-500 flex items-center justify-center text-white text-xs font-bold shadow-md">{profile ? initials : <User className="w-4 h-4" />}</div>
            <ChevronDown className={'w-3.5 h-3.5 text-slate-500 transition-transform ' + (profileOpen ? 'rotate-180' : '')} />
          </button>
          {profileOpen && (
            <div className="absolute right-0 top-12 z-50 w-64 rounded-2xl bg-[#0f1219] border border-slate-800 shadow-xl shadow-black/60 overflow-hidden animate-fade-in flex flex-col">
              <div className="p-4 border-b border-slate-800 flex items-center gap-3 bg-gradient-to-br from-indigo-500/10 to-purple-500/5 flex-shrink-0">
                <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-purple-500 to-indigo-500 flex items-center justify-center text-white font-bold text-base shadow-lg shrink-0">{profile ? initials : <User className="w-5 h-5" />}</div>
                <div className="min-w-0"><div className="text-sm font-bold text-white truncate">{profile?.full_name || 'Foydalanuvchi'}</div><div className="text-xs text-indigo-300 truncate">{profile?.email || orgName || ''}</div></div>
              </div>
              <div className="p-1.5">
                <button onClick={() => { router.push('/dashboard'); setProfileOpen(false); }} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-800/50 transition-colors"><span className="text-slate-400 flex items-center"><LayoutDashboard className="w-4 h-4" /></span>Dashboard</button>
                <button onClick={() => { router.push('/dashboard/settings'); setProfileOpen(false); }} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-800/50 transition-colors"><span className="text-slate-400 flex items-center"><Settings className="w-4 h-4" /></span>Sozlamalar</button>
              </div>
              <div className="p-1.5 border-t border-slate-800 flex-shrink-0"><button onClick={handleLogout} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-red-400 hover:bg-red-500/10 transition-colors"><LogOut className="w-4 h-4" />Chiqish</button></div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
