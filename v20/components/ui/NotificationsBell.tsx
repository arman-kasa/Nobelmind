// [FILE: V13/components/ui/NotificationsBell.tsx]
'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase' // Assumes client-side supabase helper exists
import { Bell, Check, ExternalLink } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { markNotificationReadAction, markAllNotificationsReadAction } from '@/app/actions'

interface Notification {
  id: number
  content: string
  link_url?: string
  is_read: boolean
  created_at: string
}

export default function NotificationsBell() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [isOpen, setIsOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  
  const dropdownRef = useRef<HTMLDivElement>(null)
  const router = useRouter()
  const supabase = createClient()

  // 1. Fetch Initial Data & Set up Realtime Subscription
  useEffect(() => {
    const fetchNotifications = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Fetch last 20 notifications
      const { data } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20)

      if (data) {
        setNotifications(data)
        setUnreadCount(data.filter((n: Notification) => !n.is_read).length)
      }
      setLoading(false)
    }

    fetchNotifications()

    // Realtime Listener
    const channel = supabase
      .channel('realtime-notifications')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications' },
        (payload) => {
          // Check if the notification belongs to current user (payload.new.user_id)
          // Since RLS policies might filter it, but on client 'postgres_changes' receives what triggers.
          // Better safe to re-fetch or check ID if available in payload.
          // For simplicity in this robust example, we optimize by appending if it matches user.
          // However, accessing 'user' inside this callback requires ref/state. 
          // Re-fetching is safer for data consistency.
          fetchNotifications()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase])

  // 2. Handle Click Outside to Close
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  // 3. Handlers
  const handleNotificationClick = async (n: Notification) => {
    // Optimistic Update
    if (!n.is_read) {
        setNotifications(prev => prev.map(item => item.id === n.id ? { ...item, is_read: true } : item))
        setUnreadCount(prev => Math.max(0, prev - 1))
        await markNotificationReadAction(n.id)
    }
    
    setIsOpen(false)
    
    if (n.link_url) {
        router.push(n.link_url)
    }
  }

  const handleMarkAllRead = async () => {
      setNotifications(prev => prev.map(item => ({...item, is_read: true})))
      setUnreadCount(0)
      await markAllNotificationsReadAction()
  }

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Icon Trigger */}
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-slate-500 hover:text-slate-800 transition-colors rounded-full hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
      >
        <Bell className="w-6 h-6" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white animate-pulse">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 mt-3 w-80 md:w-96 bg-white rounded-xl shadow-2xl border border-slate-100 overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 origin-top-right">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-b border-slate-100">
                <h3 className="font-semibold text-sm text-slate-800">Notifications</h3>
                {unreadCount > 0 && (
                    <button 
                        onClick={handleMarkAllRead}
                        className="text-xs text-emerald-600 hover:text-emerald-700 font-medium flex items-center gap-1"
                    >
                        <Check className="w-3 h-3" /> Mark all read
                    </button>
                )}
            </div>

            {/* List */}
            <div className="max-h-[400px] overflow-y-auto">
                {loading ? (
                    <div className="p-8 text-center text-slate-400 text-xs">Loading updates...</div>
                ) : notifications.length === 0 ? (
                    <div className="p-8 text-center flex flex-col items-center gap-2">
                        <Bell className="w-8 h-8 text-slate-200" />
                        <p className="text-slate-400 text-xs">No notifications yet.</p>
                    </div>
                ) : (
                    <ul className="divide-y divide-slate-50">
                        {notifications.map((n) => (
                            <li 
                                key={n.id} 
                                onClick={() => handleNotificationClick(n)}
                                className={`
                                    px-4 py-3 cursor-pointer hover:bg-slate-50 transition-colors group
                                    ${!n.is_read ? 'bg-blue-50/40' : ''}
                                `}
                            >
                                <div className="flex justify-between items-start gap-3">
                                    <div className="flex-1">
                                        <p className={`text-sm ${!n.is_read ? 'font-semibold text-slate-800' : 'text-slate-600'}`}>
                                            {n.content}
                                        </p>
                                        <span className="text-[10px] text-slate-400 mt-1 block">
                                            {new Date(n.created_at).toLocaleString()}
                                        </span>
                                    </div>
                                    {!n.is_read && (
                                        <span className="w-2 h-2 rounded-full bg-blue-500 mt-1.5 flex-shrink-0" />
                                    )}
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
            
            {/* Footer */}
            <div className="bg-slate-50 p-2 text-center border-t border-slate-100">
                <button className="text-[10px] text-slate-500 hover:text-slate-800 font-medium">
                    View Notification History
                </button>
            </div>
        </div>
      )}
    </div>
  )
}