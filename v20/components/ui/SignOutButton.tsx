// [FILE: components/ui/SignOutButton.tsx]
'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import { LogOut, AlertTriangle, X, Loader2 } from 'lucide-react';

interface SignOutButtonProps {
  children?: React.ReactNode;
  className?: string;
}

export default function SignOutButton({ children, className }: SignOutButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [mounted, setMounted] = useState(false); // برای اطمینان از لود شدن صفحه
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    setMounted(true);
    // وقتی مودال باز است، اسکرول صفحه اصلی را قفل کن
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => { document.body.style.overflow = 'unset'; };
  }, [isOpen]);

  const handleSignOut = async () => {
    try {
      setIsLoading(true);
      await supabase.auth.signOut();
      router.replace('/auth');
      router.refresh();
    } catch (error) {
      console.error('Error signing out:', error);
      setIsLoading(false);
    }
  };

  // محتوای مودال که قرار است خارج از منو رندر شود
  const modalContent = (
    <div 
      className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
      style={{ position: 'fixed', inset: 0 }} // استایل اجباری برای اطمینان
    >
      <div 
        className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden border border-slate-100 scale-100 animate-in zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
      >
        {/* هدر مودال */}
        <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-slate-50/50">
          <h3 className="text-lg font-bold text-slate-900">Confirm Sign Out</h3>
          <button 
            onClick={() => setIsOpen(false)}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
            disabled={isLoading}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* بدنه مودال */}
        <div className="p-6 space-y-5">
          <div className="flex items-start gap-4 p-4 bg-amber-50 border border-amber-200 rounded-xl">
            <div className="p-2 bg-amber-100 rounded-full shrink-0">
               <AlertTriangle className="w-5 h-5 text-amber-600" />
            </div>
            <div className="space-y-1">
              <p className="font-bold text-amber-900 text-sm">Security Warning</p>
              <p className="text-xs text-amber-800 leading-relaxed">
                To log back into your account, you will specifically need your <span className="font-extrabold underline">12-word recovery phrase (Seed Phrase)</span>.
              </p>
            </div>
          </div>
          <p className="text-slate-600 text-sm leading-relaxed text-center">
            Are you sure you want to sign out? If you do not have your recovery phrase, you may lose access to your account/wallet permanently.
          </p>
        </div>

        {/* دکمه‌های عملیات */}
        <div className="flex items-center justify-end gap-3 p-4 bg-slate-50 border-t border-slate-100">
          <button
            onClick={() => setIsOpen(false)}
            className="px-4 py-2.5 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-all"
            disabled={isLoading}
          >
            Cancel
          </button>
          
          <button
            onClick={handleSignOut}
            disabled={isLoading}
            className="flex items-center gap-2 px-6 py-2.5 text-sm font-bold text-white bg-red-600 border border-red-600 rounded-xl hover:bg-red-700 disabled:opacity-70"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Signing out...</span>
              </>
            ) : (
              <>
                <LogOut className="w-4 h-4" />
                <span>Yes, Sign Out</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className={className}
        type="button"
      >
        {children || (
          <div className="flex items-center gap-2">
            <LogOut className="w-4 h-4" />
            <span>Sign Out</span>
          </div>
        )}
      </button>

      {/* رندر کردن مودال در بدنه اصلی صفحه برای رفع مشکل دسکتاپ */}
      {mounted && isOpen && createPortal(modalContent, document.body)}
    </>
  );
}