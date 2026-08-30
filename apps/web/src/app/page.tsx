import Link from 'next/link';
import {
  Sparkles, Bot, Globe, BarChart3, ShieldCheck, Zap,
  CheckCircle2, ChevronRight,
} from 'lucide-react';

const features = [
  {
    icon: <Bot className="w-5 h-5 text-indigo-400" />,
    title: 'AI Avtomatik Sotuvchi',
    desc: 'AI agent 24/7 mijozlaringiz bilan Telegram, WhatsApp, web-chatdagi so\'rovlarga javob beradi va savdoningizni optimallashtiradi.',
  },
  {
    icon: <Globe className="w-5 h-5 text-cyan-400" />,
    title: 'Bir necha kanalda bitta oyna',
    desc: 'Telegram bot, web-chat va WhatsApp larda mijozlar bilan bitta dashboard oynasidan muloqot qiling.',
  },
  {
    icon: <BarChart3 className="w-5 h-5 text-violet-400" />,
    title: 'Real-vaqt Statistikalar',
    desc: 'Daromad, konversiya, mijozlar soni bo‘yicha interaktiv dashboard. Biznesingizni kuzating.',
  },
  {
    icon: <ShieldCheck className="w-5 h-5 text-emerald-400" />,
    title: 'Korporativa daraja xavfsizlik',
    desc: 'JWT autentikatsiya, JWT asosidagi so‘rovlar, GDPR moslashuvchanligi.',
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen app-shell bg-slate-950 text-slate-100">
      {/* Sticky Navbar */}
      <header className="sticky top-0 z-[100] border-b border-slate-800/60 bg-slate-950/70 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 font-semibold text-white">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-purple-600 flex items-center justify-center shadow-lg">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <span>ProSales</span>
            <span className="text-xs text-emerald-400 bg-emerald-500/10 px-1.5 py-0.25 rounded-full">Beta</span>
          </Link>
          <nav className="hidden md:flex items-center gap-7 text-sm text-slate-300">
            <Link href="#features" className="hover:text-white transition-colors">Imkoniyatlar</Link>
            <Link href="#stats" className="hover:text-white transition-colors">Natijalar</Link>
            <Link href="#demo" className="hover:text-white transition-colors">Demo</Link>
          </nav>
          <div className="flex items-center gap-2.5">
            <Link href="/login" className="btn-ghost px-4 py-2 rounded-xl text-sm font-medium">Kirish</Link>
            <Link href="/login" className="btn-primary px-5 py-2 rounded-xl text-sm font-semibold flex items-center gap-1.5">
              Boshlash <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="py-16 sm:py:20 lg:pt-24">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-indigo-500/30 bg-indigo-500/10 text-xs text-indigo-300 mb-6 animate-fade-in-up">
            <Zap className="w-3.5 h-3.5" /> Ochiq smart loyihalar uchun Powerstack Studio
          </div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold mb-6">
            <span className="text-gradient">AI bilan shaxsiy sotuv</span>
            <br />
            <span className="text-slate-100">Kommunikatsiya markazingiz — bitta oynada</span>
          </h1>
          <p className="text-slate-300/80 max-w-2xl mx-auto mb-9 text-lg">
            ProSales — bu AI yordamida Avtomatik sotuvchi, Telegram bot, web-chat
            va WhatsAppdagi mijozlar bilan bitta dashboard. Daromadingizni oshiring.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-12">
            <Link href="/login" className="btn-primary px-7 py-3 rounded-xl text-sm font-semibold flex items-center gap-2">
              Hissa olish + <ChevronRight className="w-4 h-4" />
            </Link>
            <Link href="#demo" className="btn-ghost px-7 py-3 rounded-xl text-sm font-medium">Demo ko'rish</Link>
          </div>
        </div>
      </section>
            {/* Features */}
      <section id="features" className="py-12">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-white mb-3">Imkoniyatlari</h2>
            <p className="text-slate-400 max-w-2xl mx-auto text-sm">
              ProSales — bu har bir biznes funktsiyasini birlashtirgan master-platforma.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 stagger">
            {features.map((f, i) => (
              <div key={i} className="glass-card rounded-2xl p-6 text-left">
                <div className="w-11 h-11 rounded-xl bg-slate-800/60 flex items-center justify-center mb-4">{f.icon}</div>
                <h3 className="font-bold text-white text-sm mb-1.5">{f.title}</h3>
                <p className="text-xs text-slate-400/90 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Stats / KORXONAVIY NATIJALAR */}
      <section id="stats" className="py-14">
        <div className="max-w-7xl mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="gradient-border rounded-2xl">
              <div className="glass-panel rounded-[11px] p-6">
                <div className="text-3xl font-bold text-white mb-1">+127%</div>
                <div className="text-sm text-slate-400">O'rtacha daromad oshishi</div>
              </div>
            </div>
            <div className="gradient-border rounded-2xl">
              <div className="glass-panel rounded-[11px] p-6">
                <div className="text-3xl font-bold text-white mb-1">24/7</div>
                <div className="text-sm text-slate-400">AI bilan mavjudlik</div>
              </div>
            </div>
            <div className="gradient-border rounded-2xl">
              <div className="glass-panel rounded-[11px] p-6">
                <div className="text-3xl font-bold text-white mb-1">99.9%</div>
                <div className="text-sm text-slate-400">Xavfsizlik darajasi</div>
              </div>
            </div>
          </div>
        </div>
      </section>
      {/* Demo banner */}
      <section id="demo" className="py-14">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-2xl font-bold text-white mb-3">Hisobotni ko‘rishing</h2>
          <p className="text-slate-400 text-sm mb-6 max-w-xl mx-auto">
            ProSales’ni to‘g‘dan his qilib ko‘ring. Hisobingiz yo‘q? Bepul Beta hisob yarating.
          </p>
          <Link href="/login" className="btn-primary px-7 py-3 rounded-xl text-sm font-semibold inline-flex items-center gap-2">
            Hisob yaratish <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-16 border-t border-slate-800/60 bg-slate-950/60 backdrop-blur">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
            <span>© {new Date().getFullYear()} ProSales — AI Sales SaaS Platform. Beta.</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1"><CheckCircle2 className="w-3 h-3 text-emerald-400" /> Ochiq beta</span>
            <Link href="/login" className="hover:text-slate-300 transition-colors">Kirish</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

