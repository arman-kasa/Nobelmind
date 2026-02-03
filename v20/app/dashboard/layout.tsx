// [FILE: app/dashboard/layout.tsx]
'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { createClient } from '@/lib/supabase';
// اطمینان حاصل کنید مسیر ایمپورت دکمه خروج درست باشد
import SignOutButton from '@/components/ui/SignOutButton'; 
import { LayoutGrid, Home, Briefcase, PlusCircle, User, Bell, Check, ExternalLink, LogOut } from 'lucide-react';
import { AuroraBackground, ToastProvider } from '@/components/ui/shared';
import { markNotificationReadAction, markAllNotificationsReadAction } from '@/app/actions';

// =================================================================
// COMPONENTS
// =================================================================

// Optimized Notification Dropdown
// تغییر ۱: اضافه شدن onItemClick به ورودی‌ها
const NotificationDropdown = React.memo(({ notifications, isOpen, onClose, onMarkRead, onItemClick }: any) => {
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  // Router را از اینجا حذف کردیم و به والد منتقل کردیم تا مدیریت بهتری داشته باشیم

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div ref={dropdownRef} className="absolute right-0 top-12 w-80 md:w-96 bg-white rounded-xl shadow-2xl border border-slate-100 z-[100] overflow-hidden animate-in fade-in zoom-in-95 origin-top-right">
      <div className="p-3 border-b border-slate-50 bg-slate-50/50 flex justify-between items-center">
        <span className="text-xs font-bold text-slate-700">Notifications</span>
        <button onClick={onMarkRead} className="text-[10px] text-emerald-600 cursor-pointer hover:underline font-medium flex items-center gap-1">
          <Check className="w-3 h-3" /> Mark all read
        </button>
      </div>
      <div className="max-h-80 overflow-y-auto">
        {notifications.length === 0 ? (
          <div className="p-8 text-center flex flex-col items-center gap-2">
            <Bell className="w-6 h-6 text-slate-200" />
            <span className="text-xs text-slate-400">No new notifications</span>
          </div>
        ) : (
          notifications.map((n: any) => (
            <div 
                key={n.id} 
                // تغییر ۲: فراخوانی تابع والد هنگام کلیک
                onClick={() => {
                    onClose();
                    onItemClick(n);
                }}
                className={`p-4 border-b border-slate-50 hover:bg-slate-50 transition-colors flex gap-3 cursor-pointer group ${!n.is_read ? 'bg-blue-50/40' : ''}`}
            >
              <div className={`w-2 h-2 mt-1.5 rounded-full flex-shrink-0 ${n.is_read ? 'bg-slate-200' : 'bg-blue-500'}`} />
              <div className="flex-1">
                <p className={`text-xs leading-relaxed mb-1 ${!n.is_read ? 'font-semibold text-slate-800' : 'text-slate-600'}`}>
                    {n.content}
                </p>
                <div className="flex justify-between items-center">
                    <span className="text-[10px] text-slate-400">{new Date(n.created_at).toLocaleDateString()}</span>
                    {n.link_url && <ExternalLink className="w-3 h-3 text-slate-300 group-hover:text-blue-500" />}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
      <div className="bg-slate-50 p-2 text-center border-t border-slate-100">
        <button className="text-[10px] text-slate-500 hover:text-slate-800 font-medium">View History</button>
      </div>
    </div>
  );
});
NotificationDropdown.displayName = 'NotificationDropdown';

// =================================================================
// MAIN LAYOUT
// =================================================================

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [supabase] = useState(() => createClient());
  const [userType, setUserType] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  
  // Notification State
  const [notifications, setNotifications] = useState<any[]>([]);
  const [showNotifs, setShowNotifs] = useState(false);
  const unreadCount = notifications.filter(n => !n.is_read).length;

  const fetchNotifications = useCallback(async (uid: string) => {
      const { data } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', uid)
        .order('created_at', { ascending: false })
        .limit(20);
      if (data) setNotifications(data);
  }, [supabase]);

  useEffect(() => {
    let mounted = true;

    const checkUser = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { 
            if (mounted) router.push('/auth'); 
            return; 
        }
        
        if (mounted) setUserId(user.id);
        
        const [profileRes] = await Promise.all([
           supabase.from('profiles').select('user_type').eq('id', user.id).single(),
           fetchNotifications(user.id)
        ]);

        if (mounted && profileRes.data) {
           setUserType(profileRes.data.user_type);
        }

        const channel = supabase.channel(`notifs-${user.id}`)
          .on('postgres_changes', 
            { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` }, 
            (payload) => {
              if (mounted) {
                setNotifications(prev => [payload.new, ...prev]);
              }
            }
          )
          .subscribe();

        return () => { 
           supabase.removeChannel(channel); 
        };
    };

    checkUser();

    return () => { mounted = false; };
  }, [supabase, router, fetchNotifications]);

  const handleMarkAllRead = async () => {
    if (!userId) return;
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    await markAllNotificationsReadAction();
  };

  // تغییر ۳: تابع جدید برای مدیریت کلیک روی یک نوتیفیکیشن
  const handleNotificationClick = async (n: any) => {
    // ۱. آپدیت آنی وضعیت در UI (حذف تیک آبی بلافاصله)
    setNotifications(prev => prev.map(item => 
        item.id === n.id ? { ...item, is_read: true } : item
    ));

    // ۲. نویگیت کردن (اگر لینک داشت)
    if (n.link_url) {
        router.push(n.link_url);
    }

    // ۳. ارسال درخواست به سرور در پس‌زمینه
    await markNotificationReadAction(n.id);
  };

  const navItems = [
    { name: 'Home', path: '/dashboard', icon: Home },
    ...(userType === 'freelancer' ? [{ name: 'Jobs', path: '/dashboard/marketplace', icon: Briefcase }] : []),
    ...(userType === 'client' ? [{ name: 'Post', path: '/dashboard/create-project', icon: PlusCircle }] : []),
    { name: 'Profile', path: '/dashboard/profile', icon: User },
  ];

  const isActive = (path: string) => pathname === path;

  return (
    <ToastProvider>
      <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-blue-100 overflow-x-hidden pb-24 md:pb-0">
        <AuroraBackground />
        
        {/* Desktop Navbar */}
        <div className="fixed top-0 left-0 right-0 z-[50] hidden md:flex justify-center pt-6 px-4 pointer-events-none">
          <nav className="w-full max-w-6xl bg-white/90 backdrop-blur-xl border border-slate-200 rounded-2xl shadow-xl shadow-slate-200/50 px-6 h-16 flex items-center justify-between pointer-events-auto">
            <div className="flex items-center gap-3 cursor-pointer" onClick={() => router.push('/dashboard')}>
              <div className="w-9 h-9 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center text-white">
                <LayoutGrid className="w-5 h-5" />
              </div>
              <span className="text-lg font-bold tracking-tight text-slate-800">Noble Mind</span>
            </div>
            
            <div className="flex items-center gap-8">
              {navItems.map(item => (
                <div 
                    key={item.path}
                    onClick={() => router.push(item.path)} 
                    className={`text-sm font-medium transition-colors cursor-pointer flex items-center gap-2 ${isActive(item.path) ? 'text-blue-600 bg-blue-50 px-3 py-1.5 rounded-lg' : 'text-slate-600 hover:text-blue-600'}`}
                >
                    <item.icon className="w-4 h-4" />
                    {item.name}
                </div>
              ))}
            </div>

            <div className="flex items-center gap-4">
               {/* Functional Notification Bell */}
               <div className="relative">
                  <button 
                    onClick={() => setShowNotifs(!showNotifs)}
                    className={`relative p-2 transition-colors rounded-lg ${showNotifs ? 'bg-blue-50 text-blue-600' : 'text-slate-500 hover:text-blue-600'}`}
                  >
                      <Bell className="w-5 h-5" />
                      {unreadCount > 0 && (
                        <span className="absolute top-1.5 right-1.5 flex h-2.5 w-2.5">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500 border border-white"></span>
                        </span>
                      )}
                  </button>
                  <NotificationDropdown 
                    notifications={notifications} 
                    isOpen={showNotifs} 
                    onClose={() => setShowNotifs(false)} 
                    onMarkRead={handleMarkAllRead}
                    onItemClick={handleNotificationClick} // تغییر ۴: پاس دادن تابع هندلر
                  />
               </div>

              {/* دکمه خروج اصلاح شده */}
              <SignOutButton className="text-sm font-medium text-red-500 hover:text-red-600 transition-colors px-2 flex items-center gap-2">
                <LogOut className="w-4 h-4" /> Sign Out
              </SignOutButton>
            </div>
          </nav>
        </div>

        {/* Mobile Navbar */}
        <div className="fixed bottom-0 left-0 right-0 z-[50] bg-white border-t border-slate-200 md:hidden pb-safe">
            <div className="flex justify-around items-center h-16">
                {navItems.map(item => (
                    <button 
                        key={item.path}
                        onClick={() => router.push(item.path)}
                        className={`flex flex-col items-center justify-center w-full h-full space-y-1 ${isActive(item.path) ? 'text-blue-600' : 'text-slate-400'}`}
                    >
                        <item.icon className={`w-6 h-6 ${isActive(item.path) ? 'fill-current' : ''}`} />
                        <span className="text-[10px] font-medium">{item.name}</span>
                    </button>
                ))}
                 
                 <SignOutButton className="flex flex-col items-center justify-center w-full h-full space-y-1 text-slate-400 hover:text-red-500 transition-colors">
                    <LogOut className="w-6 h-6" />
                    <span className="text-[10px] font-medium">Exit</span>
                </SignOutButton>
            </div>
        </div>

        <main className="relative z-10 pt-6 md:pt-28 px-4 md:px-6 max-w-6xl mx-auto">
          {children}
        </main>
      </div>
    </ToastProvider>
  );
}