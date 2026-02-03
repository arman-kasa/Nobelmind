'use client';
import React, { useState, useEffect, useRef } from 'react';
import { createClient } from '@/lib/supabase';
import { MessageCircle, X, Send, Loader2, Headphones } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function SupportChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [ticketId, setTicketId] = useState<string | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const supabase = createClient();

  // Load existing ticket from localStorage
  useEffect(() => {
    const storedTicket = localStorage.getItem('noble_support_ticket');
    if (storedTicket) {
      setTicketId(storedTicket);
      fetchMessages(storedTicket);
    }
  }, []);

  // Subscribe to Realtime messages
useEffect(() => {
    if (!ticketId) return;

    // گوش دادن به تغییرات خودِ تیکت (برای فهمیدن بسته شدن آن)
    const statusChannel = supabase.channel(`ticket_status_${ticketId}`)
        .on(
            'postgres_changes', 
            { 
                event: 'UPDATE', 
                schema: 'public', 
                table: 'support_tickets', 
                filter: `id=eq.${ticketId}` 
            },
            (payload) => {
                // اگر وضعیت تیکت بسته شد
                if (payload.new.status === 'closed') {
                    // 1. پاک کردن توکن از حافظه مرورگر
                    localStorage.removeItem('noble_support_ticket');
                    
                    // 2. ریست کردن استیت‌ها
                    setTicketId(null);
                    setMessages([]);
                    setIsOpen(false);
                    
                    // 3. نمایش پیام به کاربر (اختیاری)
                    alert("The conversation has been closed...");
                }
            }
        )
        .subscribe();

    return () => { supabase.removeChannel(statusChannel); };
}, [ticketId]); // این افکت وابسته به ticketId است

  const fetchMessages = async (id: string) => {
    const { data } = await supabase.from('support_messages').select('*').eq('ticket_id', id).order('created_at', { ascending: true });
    if (data) setMessages(data);
    scrollToBottom();
  };

  const scrollToBottom = () => {
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    setLoading(true);
    let currentTicketId = ticketId;

    // Create ticket if doesn't exist
    if (!currentTicketId) {
      const { data: ticket, error } = await supabase.from('support_tickets').insert([
        { visitor_token: 'guest-' + Date.now(), status: 'open' } // Simplified token logic
      ]).select().single();
      
      if (ticket) {
        currentTicketId = ticket.id;
        setTicketId(ticket.id);
        localStorage.setItem('noble_support_ticket', ticket.id);
      }
    }

    // Send Message
    if (currentTicketId) {
      await supabase.from('support_messages').insert([
        { ticket_id: currentTicketId, content: newMessage, sender_type: 'visitor' }
      ]);
      setNewMessage('');
    }
    setLoading(false);
  };

  return (
    <div className="fixed bottom-6 right-6 z-[9999] font-sans">
      <AnimatePresence>
        {isOpen && (
          <motion.div 
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="absolute bottom-16 right-0 w-[350px] bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col h-[500px]"
          >
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-4 flex justify-between items-center text-white">
              <div className="flex items-center gap-3">
                <div className="bg-white/20 p-2 rounded-lg">
                    <Headphones className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm">Noble Support</h3>
                  <p className="text-[10px] opacity-80 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse"/> We are online
                  </p>
                </div>
              </div>
              <button onClick={() => setIsOpen(false)} className="hover:bg-white/20 p-1 rounded transition">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Chat Area */}
            <div className="flex-1 bg-slate-50 p-4 overflow-y-auto space-y-3">
               {messages.length === 0 && (
                   <div className="text-center text-slate-400 text-xs mt-10">
                       <p>👋 Hi! How can we help you today?</p>
                       <p className="mt-1">Ask us anything about the platform.</p>
                   </div>
               )}
               {messages.map((msg) => (
                 <div key={msg.id} className={`flex ${msg.sender_type === 'visitor' ? 'justify-end' : 'justify-start'}`}>
                   <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm ${
                     msg.sender_type === 'visitor' 
                     ? 'bg-blue-600 text-white rounded-tr-none' 
                     : 'bg-white border border-slate-200 text-slate-700 rounded-tl-none shadow-sm'
                   }`}>
                     {msg.content}
                   </div>
                 </div>
               ))}
               <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <form onSubmit={handleSendMessage} className="p-3 bg-white border-t border-slate-100 flex gap-2">
              <input 
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Type your message..."
                className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-blue-500 transition"
              />
              <button 
                type="submit" 
                disabled={loading}
                className="bg-blue-600 hover:bg-blue-700 text-white p-2.5 rounded-xl transition-colors disabled:opacity-50"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin"/> : <Send className="w-4 h-4" />}
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsOpen(!isOpen)}
        className="bg-blue-600 hover:bg-blue-700 text-white p-4 rounded-full shadow-lg shadow-blue-600/30 transition-all flex items-center justify-center"
      >
        {isOpen ? <X className="w-6 h-6" /> : <MessageCircle className="w-6 h-6" />}
      </motion.button>
    </div>
  );
}