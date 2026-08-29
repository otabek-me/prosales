'use client';

import React, { useState, useEffect, useRef } from 'react';
import { MessageSquare, Send, Loader2, Bot, User, Radio, MessageCircle, AlertTriangle, CheckCircle, RefreshCw } from 'lucide-react';
import { apiGet, apiPost, apiPut } from '@/lib/api';

export default function InboxPage() {
  const [conversations, setConversations] = useState<any[]>([]);
  const [selectedConv, setSelectedConv] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [msgLoading, setMsgLoading] = useState(false);
  const [newMsg, setNewMsg] = useState('');
  const [sending, setSending] = useState(false);
  const [filter, setFilter] = useState<'ALL' | 'OPERATOR' | 'AI'>('ALL');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const selectedConvRef = useRef<any>(null);

  selectedConvRef.current = selectedConv;

  useEffect(() => {
    loadConversations(true);

    // Live auto-polling every 3.5 seconds
    const interval = setInterval(() => {
      loadConversations(false);
      if (selectedConvRef.current) {
        refreshCurrentMessages(selectedConvRef.current.id);
      }
    }, 3500);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const loadConversations = async (showSpinner = false) => {
    try {
      if (showSpinner) setLoading(true);
      const res = await apiGet('/conversations');
      const list = res.data || [];
      setConversations(list);
    } catch (err) {
      console.error('Suhbatlarni yuklashda xatolik:', err);
    } finally {
      if (showSpinner) setLoading(false);
    }
  };

  const refreshCurrentMessages = async (convId: string) => {
    try {
      const res = await apiGet(`/conversations/${convId}/messages`);
      setMessages(res.data || []);
    } catch (err) {
      console.error(err);
    }
  };

  const selectConversation = async (conv: any) => {
    setSelectedConv(conv);
    setMsgLoading(true);
    try {
      const res = await apiGet(`/conversations/${conv.id}/messages`);
      setMessages(res.data || []);
      // Reset unread count locally
      setConversations(prev => prev.map(c => c.id === conv.id ? { ...c, unread_count: 0 } : c));
    } catch (err) {
      console.error(err);
    } finally {
      setMsgLoading(false);
    }
  };

  const sendMessage = async () => {
    if (!newMsg.trim() || !selectedConv) return;
    const msgToSend = newMsg.trim();
    setSending(true);
    try {
      await apiPost(`/conversations/${selectedConv.id}/messages`, {
        content: msgToSend,
        message: msgToSend
      });
      setNewMsg('');
      await refreshCurrentMessages(selectedConv.id);
    } catch (err: any) {
      console.error('Xabar yuborishda xatolik:', err);
    } finally {
      setSending(false);
    }
  };

  const toggleOperatorMode = async (conv: any) => {
    try {
      const newMode = !conv.is_operator_mode;
      await apiPut(`/conversations/${conv.id}/operator-mode`, {
        is_operator_mode: newMode
      });
      setConversations(prev => prev.map(c => c.id === conv.id ? { ...c, is_operator_mode: newMode } : c));
      if (selectedConv?.id === conv.id) {
        setSelectedConv({ ...selectedConv, is_operator_mode: newMode });
      }
    } catch (err) {
      console.error(err);
    }
  };

  const filteredConversations = conversations.filter(c => {
    if (filter === 'OPERATOR') return c.is_operator_mode;
    if (filter === 'AI') return !c.is_operator_mode;
    return true;
  });

  const operatorRequestsCount = conversations.filter(c => c.is_operator_mode).length;

  const senderIcon = (type: string) => {
    if (type === 'AI') return <Bot className="w-4 h-4 text-indigo-400" />;
    if (type === 'OPERATOR') return <User className="w-4 h-4 text-emerald-400" />;
    return <User className="w-4 h-4 text-slate-400" />;
  };

  const senderColor = (type: string) => {
    if (type === 'AI') return 'bg-indigo-500/10 border-indigo-500/20';
    if (type === 'OPERATOR') return 'bg-emerald-500/10 border-emerald-500/20';
    return 'bg-slate-800/50 border-slate-700';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Top Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-indigo-400" /> Jonli Muloqotlar (Live Inbox)
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">Telegram bot mijozlari bilan real vaqtda muloqot va AI boshqaruvi.</p>
        </div>

        {/* Filter Badges */}
        <div className="flex items-center gap-2 bg-slate-900/60 p-1 rounded-xl border border-slate-800">
          <button
            onClick={() => setFilter('ALL')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              filter === 'ALL' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
            }`}
          >
            Barchasi ({conversations.length})
          </button>
          <button
            onClick={() => setFilter('OPERATOR')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${
              filter === 'OPERATOR'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                : 'text-slate-400 hover:text-amber-300'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            Operator so&apos;rovlari ({operatorRequestsCount})
          </button>
          <button
            onClick={() => setFilter('AI')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              filter === 'AI' ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/30' : 'text-slate-400 hover:text-indigo-300'
            }`}
          >
            AI boshqaruvida
          </button>
        </div>
      </div>

      <div className="flex gap-4 h-[calc(100vh-210px)]">
        {/* Conversations List */}
        <div className="w-80 glass-panel rounded-2xl border border-slate-800 overflow-hidden flex flex-col">
          <div className="p-3 border-b border-slate-800 flex justify-between items-center bg-slate-900/40">
            <span className="text-xs text-slate-400 font-medium">Faol muloqotlar</span>
            <button
              onClick={() => loadConversations(false)}
              className="p-1 rounded-lg text-slate-400 hover:text-white transition-colors"
              title="Yangilash"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-slate-800/40">
            {filteredConversations.length === 0 ? (
              <div className="p-6 text-center">
                <MessageCircle className="w-10 h-10 text-slate-600 mx-auto mb-2" />
                <p className="text-sm text-slate-400">Hozircha suhbatlar yo&apos;q</p>
                <p className="text-xs text-slate-500 mt-1">Telegram botga yozilgan xabarlar shu yerda avtomatik ko&apos;rinadi</p>
              </div>
            ) : (
              filteredConversations.map((conv) => (
                <div
                  key={conv.id}
                  onClick={() => selectConversation(conv)}
                  className={`p-3.5 cursor-pointer hover:bg-slate-800/40 transition-all ${
                    selectedConv?.id === conv.id ? 'bg-indigo-600/10 border-l-2 border-l-indigo-500' : ''
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-purple-600 flex items-center justify-center text-white text-sm font-bold flex-shrink-0 shadow-md">
                      {(conv.customer?.first_name || 'M')[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold text-white truncate">
                          {conv.customer?.first_name || 'Mijoz'} {conv.customer?.last_name || ''}
                        </span>
                        {conv.unread_count > 0 && (
                          <span className="w-5 h-5 rounded-full bg-indigo-500 text-white text-[11px] font-bold flex items-center justify-center flex-shrink-0">
                            {conv.unread_count}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-xs text-slate-400 truncate">
                          @{conv.customer?.username || (conv.customer?.phone || 'Telegram')}
                        </span>
                        {conv.is_operator_mode ? (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-semibold border border-amber-500/30 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                            Operator
                          </span>
                        ) : (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 font-medium border border-indigo-500/30">
                            AI Bot
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Chat Area */}
        <div className="flex-1 glass-panel rounded-2xl border border-slate-800 overflow-hidden flex flex-col">
          {!selectedConv ? (
            <div className="flex-1 flex items-center justify-center text-slate-400">
              <div className="text-center">
                <MessageSquare className="w-12 h-12 mx-auto mb-3 text-slate-600" />
                <h4 className="text-base font-medium text-white mb-1">Muloqot tanlanmagan</h4>
                <p className="text-xs text-slate-500">Chap tarafdan istalgan mijoz suhbatini tanlang</p>
              </div>
            </div>
          ) : (
            <>
              {/* Chat Header */}
              <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/40">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-purple-600 flex items-center justify-center text-white text-sm font-bold">
                    {(selectedConv.customer?.first_name || 'M')[0]}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-bold text-white">
                        {selectedConv.customer?.first_name || 'Mijoz'} {selectedConv.customer?.last_name || ''}
                      </p>
                      {selectedConv.customer?.phone && (
                        <span className="text-xs text-indigo-300 font-mono bg-indigo-500/10 px-2 py-0.5 rounded-md border border-indigo-500/20">
                          {selectedConv.customer.phone}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400">
                      Telegram ID: {selectedConv.customer?.telegram_id} {selectedConv.customer?.username ? `(@${selectedConv.customer.username})` : ''}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => toggleOperatorMode(selectedConv)}
                    className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 shadow-sm ${
                      selectedConv.is_operator_mode
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30'
                        : 'bg-slate-800 text-slate-300 border border-slate-700 hover:bg-slate-700'
                    }`}
                  >
                    {selectedConv.is_operator_mode ? (
                      <>
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                        Operator rejimida (AI ga qaytarish)
                      </>
                    ) : (
                      <>
                        <User className="w-3.5 h-3.5 text-emerald-400" />
                        Operatorga o&apos;tkazish
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Operator Alert Banner */}
              {selectedConv.is_operator_mode && (
                <div className="px-4 py-2 bg-amber-500/10 border-b border-amber-500/20 flex items-center justify-between text-xs text-amber-300">
                  <span className="flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-amber-400" />
                    Mijoz operator bilan bog&apos;lanishni kutmoqda. Quyidan to&apos;g&apos;ridan-to&apos;g&apos;ri javob yozishingiz mumkin.
                  </span>
                </div>
              )}

              {/* Messages History */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3.5">
                {msgLoading ? (
                  <div className="flex justify-center py-12">
                    <Loader2 className="w-6 h-6 text-indigo-400 animate-spin" />
                  </div>
                ) : messages.length === 0 ? (
                  <p className="text-center text-slate-500 text-sm py-12">Hozircha xabarlar mavjud emas</p>
                ) : (
                  messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex ${msg.sender_type === 'CUSTOMER' ? 'justify-start' : 'justify-end'}`}
                    >
                      <div className={`max-w-[75%] p-3.5 rounded-2xl border shadow-sm ${senderColor(msg.sender_type)}`}>
                        <div className="flex items-center justify-between gap-3 mb-1.5">
                          <div className="flex items-center gap-1.5">
                            {senderIcon(msg.sender_type)}
                            <span className="text-[11px] font-semibold tracking-wide text-slate-400 uppercase">
                              {msg.sender_type === 'CUSTOMER' ? (selectedConv.customer?.first_name || 'Mijoz') : msg.sender_type === 'AI' ? 'AI Sotuvchi' : 'Operator'}
                            </span>
                          </div>
                          <span className="text-[10px] text-slate-500 font-mono">
                            {msg.created_at ? new Date(msg.created_at).toLocaleTimeString('uz', { hour: '2-digit', minute: '2-digit' }) : ''}
                          </span>
                        </div>
                        <p className="text-sm text-slate-100 whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                      </div>
                    </div>
                  ))
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Quick Reply & Send Message Box */}
              <div className="p-3.5 border-t border-slate-800 bg-slate-900/40">
                <div className="flex gap-2">
                  <input
                    value={newMsg}
                    onChange={(e) => setNewMsg(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        sendMessage();
                      }
                    }}
                    className="flex-1 px-4 py-3 rounded-xl bg-slate-800/60 border border-slate-700 text-white text-sm placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
                    placeholder="Mijozga operator nomidan javob yozing (Enter bosing)..."
                  />
                  <button
                    onClick={sendMessage}
                    disabled={sending || !newMsg.trim()}
                    className="px-5 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/30"
                  >
                    {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    <span className="hidden sm:inline text-xs font-semibold">Yuborish</span>
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
