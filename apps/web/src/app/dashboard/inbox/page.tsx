'use client';

import React, { useState, useEffect, useRef } from 'react';
import { MessageSquare, Send, Loader2, Bot, User, Radio, MessageCircle } from 'lucide-react';
import { apiGet, apiPost, apiPut } from '@/lib/api';

export default function InboxPage() {
  const [conversations, setConversations] = useState<any[]>([]);
  const [selectedConv, setSelectedConv] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [msgLoading, setMsgLoading] = useState(false);
  const [newMsg, setNewMsg] = useState('');
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadConversations();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const loadConversations = async () => {
    try {
      setLoading(true);
      const res = await apiGet('/conversations');
      setConversations(res.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const selectConversation = async (conv: any) => {
    setSelectedConv(conv);
    setMsgLoading(true);
    try {
      const res = await apiGet(`/conversations/${conv.id}/messages`);
      setMessages(res.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setMsgLoading(false);
    }
  };

  const sendMessage = async () => {
    if (!newMsg.trim() || !selectedConv) return;
    setSending(true);
    try {
      await apiPost(`/conversations/${selectedConv.id}/messages`, { content: newMsg });
      setNewMsg('');
      const res = await apiGet(`/conversations/${selectedConv.id}/messages`);
      setMessages(res.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setSending(false);
    }
  };

  const toggleOperatorMode = async (conv: any) => {
    try {
      await apiPut(`/conversations/${conv.id}/operator-mode`, {
        is_operator_mode: !conv.is_operator_mode
      });
      await loadConversations();
      if (selectedConv?.id === conv.id) {
        setSelectedConv({ ...conv, is_operator_mode: !conv.is_operator_mode });
      }
    } catch (err) {
      console.error(err);
    }
  };

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
      <h2 className="text-xl font-bold text-white flex items-center gap-2">
        <MessageSquare className="w-5 h-5 text-indigo-400" /> Live Inbox
      </h2>

      <div className="flex gap-4 h-[calc(100vh-200px)]">
        {/* Conversations List */}
        <div className="w-80 glass-panel rounded-2xl border border-slate-800 overflow-hidden flex flex-col">
          <div className="p-3 border-b border-slate-800">
            <p className="text-xs text-slate-400 font-medium">Suhbatlar ({conversations.length})</p>
          </div>

          <div className="flex-1 overflow-y-auto">
            {conversations.length === 0 ? (
              <div className="p-6 text-center">
                <MessageCircle className="w-10 h-10 text-slate-600 mx-auto mb-2" />
                <p className="text-sm text-slate-400">Hozircha suhbatlar yo&apos;q</p>
                <p className="text-xs text-slate-500 mt-1">Telegram botga yozganlar shu yerda ko&apos;rinadi</p>
              </div>
            ) : (
              conversations.map((conv) => (
                <div
                  key={conv.id}
                  onClick={() => selectConversation(conv)}
                  className={`p-3 border-b border-slate-800/50 cursor-pointer hover:bg-slate-800/30 transition-colors ${
                    selectedConv?.id === conv.id ? 'bg-indigo-500/10 border-l-2 border-l-indigo-500' : ''
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                      {(conv.customer?.first_name || '?')[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-white truncate">
                          {conv.customer?.first_name || 'Noma\'lum'}
                        </span>
                        {conv.unread_count > 0 && (
                          <span className="w-5 h-5 rounded-full bg-indigo-500 text-white text-xs flex items-center justify-center flex-shrink-0">
                            {conv.unread_count}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1 mt-0.5">
                        {conv.is_operator_mode ? (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400">Operator</span>
                        ) : (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-400">AI</span>
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
                <p className="text-sm">Suhbatni tanlang</p>
              </div>
            </div>
          ) : (
            <>
              {/* Chat Header */}
              <div className="p-4 border-b border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center text-white text-xs font-bold">
                    {(selectedConv.customer?.first_name || '?')[0]}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white">{selectedConv.customer?.first_name || 'Mijoz'}</p>
                    <p className="text-xs text-slate-400">@{selectedConv.customer?.username || '-'}</p>
                  </div>
                </div>
                <button
                  onClick={() => toggleOperatorMode(selectedConv)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    selectedConv.is_operator_mode
                      ? 'bg-indigo-500/20 text-indigo-400 hover:bg-indigo-500/30'
                      : 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30'
                  }`}
                >
                  {selectedConv.is_operator_mode ? '🤖 AI ga qaytarish' : '👨‍💼 Operator rejimi'}
                </button>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {msgLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="w-6 h-6 text-indigo-400 animate-spin" />
                  </div>
                ) : messages.length === 0 ? (
                  <p className="text-center text-slate-400 text-sm py-8">Hozircha xabarlar yo&apos;q</p>
                ) : (
                  messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex ${msg.sender_type === 'CUSTOMER' ? 'justify-start' : 'justify-end'}`}
                    >
                      <div className={`max-w-[70%] p-3 rounded-xl border ${senderColor(msg.sender_type)}`}>
                        <div className="flex items-center gap-1.5 mb-1">
                          {senderIcon(msg.sender_type)}
                          <span className="text-[10px] text-slate-500 uppercase">{msg.sender_type}</span>
                        </div>
                        <p className="text-sm text-white whitespace-pre-wrap">{msg.content}</p>
                        <p className="text-[10px] text-slate-500 mt-1">
                          {msg.created_at ? new Date(msg.created_at).toLocaleTimeString('uz') : ''}
                        </p>
                      </div>
                    </div>
                  ))
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Send Message */}
              {selectedConv.is_operator_mode && (
                <div className="p-3 border-t border-slate-800">
                  <div className="flex gap-2">
                    <input
                      value={newMsg}
                      onChange={(e) => setNewMsg(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
                      className="flex-1 px-4 py-2.5 rounded-xl bg-slate-800/50 border border-slate-700 text-white text-sm placeholder:text-slate-500 focus:outline-none focus:border-indigo-500"
                      placeholder="Xabar yozing..."
                    />
                    <button
                      onClick={sendMessage}
                      disabled={sending || !newMsg.trim()}
                      className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white transition-all disabled:opacity-50"
                    >
                      {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
