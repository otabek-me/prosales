'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  MessageSquare,
  Users,
  ShoppingBag,
  ShoppingCart,
  Bot,
  BookOpen,
  BarChart3,
  CreditCard,
  Settings,
  ShieldAlert,
  Sparkles
} from 'lucide-react';

const menuItems = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Live Inbox', href: '/dashboard/inbox', icon: MessageSquare, badge: 'Live' },
  { name: 'Customers CRM', href: '/dashboard/customers', icon: Users },
  { name: 'Products Catalog', href: '/dashboard/products', icon: ShoppingBag },
  { name: 'Orders Pipeline', href: '/dashboard/orders', icon: ShoppingCart },
  { name: 'Telegram Bot', href: '/dashboard/bot', icon: Bot },
  { name: 'Knowledge Base', href: '/dashboard/knowledge', icon: BookOpen },
  { name: 'Analytics', href: '/dashboard/analytics', icon: BarChart3 },
  { name: 'Billing & SaaS', href: '/dashboard/billing', icon: CreditCard },
  { name: 'AI Settings', href: '/dashboard/settings', icon: Settings },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 flex-shrink-0 h-full border-r border-slate-800/60 bg-[#0a0d14] flex flex-col justify-between p-4 hidden md:flex">
      <div>
        {/* Brand Logo */}
        <div className="flex items-center gap-3 px-2 py-3 mb-6 border-b border-slate-800">
          <div className="w-10 h-10 flex-shrink-0 rounded-xl bg-gradient-to-tr from-indigo-600 to-purple-500 flex items-center justify-center shadow-lg shadow-indigo-500/30 animate-float">
            <Sparkles className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="font-bold text-lg font-display">
              <span className="text-gradient">SalesAI</span>
            </h1>
            <p className="text-xs text-indigo-400 font-medium">Uzbekistan AI Engine</p>
          </div>
        </div>

        {/* Navigation Menu */}
        <nav className="space-y-1">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`group relative flex items-center justify-between px-3 py-2.5 rounded-xl font-medium text-sm transition-all duration-200 ${
                  isActive
                    ? 'bg-gradient-to-r from-indigo-600/25 to-purple-600/15 text-indigo-300 border border-indigo-500/30 shadow-inner'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                }`}
              >
                {isActive && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 rounded-r-full bg-gradient-to-b from-indigo-400 to-purple-400" />
                )}
                <div className="flex items-center gap-3">
                  <Icon className={`w-5 h-5 transition-colors ${isActive ? 'text-indigo-400' : 'text-slate-400 group-hover:text-indigo-300'}`} />
                  <span>{item.name}</span>
                </div>
                {item.badge && (
                  <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 animate-pulse">
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Super Admin Quick Link */}
      <div className="pt-4 border-t border-slate-800">
        <Link
          href="/superadmin"
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold text-purple-400 bg-purple-500/10 border border-purple-500/20 hover:bg-purple-500/25 hover:border-purple-500/40 hover:text-purple-300 transition-all"
        >
          <ShieldAlert className="w-4 h-4" />
          <span>Super Admin Platform</span>
        </Link>
      </div>
    </aside>
  );
}
