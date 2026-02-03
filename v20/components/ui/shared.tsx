'use client';
import React, { createContext, useContext, useState, useEffect } from 'react';
import { Sparkles, X, CheckCircle, AlertTriangle, Info } from 'lucide-react';
import { createPortal } from 'react-dom';

// --- Types ---
type ToastType = 'success' | 'error' | 'info';
interface ToastContextType {
  showToast: (message: string, type?: ToastType) => void;
}

// --- Toast Context ---
const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used within a ToastProvider');
  return context;
};

export const ToastProvider = ({ children }: { children: React.ReactNode }) => {
  const [toasts, setToasts] = useState<{id: number, msg: string, type: ToastType}[]>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const showToast = (message: string, type: ToastType = 'info') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, msg: message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3000);
  };

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {mounted && typeof document !== 'undefined' && createPortal(
        <div className="fixed top-5 right-5 z-[100] flex flex-col gap-2 pointer-events-none">
          {toasts.map(t => (
            <div key={t.id} className={`
              animate-in slide-in-from-right fade-in duration-300 pointer-events-auto
              min-w-[300px] p-4 rounded-xl shadow-lg border flex items-center gap-3 bg-white
              ${t.type === 'success' ? 'border-emerald-200 text-emerald-800' : 
                t.type === 'error' ? 'border-red-200 text-red-800' : 'border-blue-200 text-blue-800'}
            `}>
              {t.type === 'success' && <CheckCircle className="w-5 h-5 text-emerald-500" />}
              {t.type === 'error' && <AlertTriangle className="w-5 h-5 text-red-500" />}
              {t.type === 'info' && <Info className="w-5 h-5 text-blue-500" />}
              <span className="text-sm font-medium">{t.msg}</span>
            </div>
          ))}
        </div>,
        document.body
      )}
    </ToastContext.Provider>
  );
};

// --- Existing Components (Memoized) ---

export const Button = React.memo(({ children, variant = 'primary', className = '', onClick, icon: Icon, disabled, title }: any) => {
  const baseStyle = "group relative inline-flex items-center justify-center px-6 py-3 rounded-xl font-medium text-sm transition-all duration-300 active:scale-95 border touch-manipulation disabled:opacity-50 disabled:cursor-not-allowed shadow-sm select-none";
  
  const variants: any = {
    primary: "bg-blue-600 text-white border-transparent hover:bg-blue-700 shadow-blue-200",
    secondary: "bg-white text-slate-700 border-slate-200 hover:bg-slate-50 hover:border-slate-300",
    outline: "border-slate-200 text-slate-600 hover:text-blue-600 hover:border-blue-200 bg-transparent",
    ghost: "border-transparent text-slate-500 hover:text-slate-900 hover:bg-slate-100 shadow-none",
    success: "bg-emerald-600 text-white border-transparent hover:bg-emerald-700 shadow-emerald-200",
    danger: "bg-red-50 text-red-600 border-red-100 hover:bg-red-100 shadow-none"
  };

  return (
    <button className={`${baseStyle} ${variants[variant]} ${className} overflow-hidden`} onClick={onClick} disabled={disabled} title={title}>
      <span className="relative z-20 flex items-center gap-2">
        {children}
        {Icon && <Icon className="w-4 h-4 transition-transform group-hover:translate-x-1" />}
      </span>
    </button>
  );
});
Button.displayName = 'Button';

export const Badge = React.memo(({ children, variant = 'default', className='' }: any) => {
  const styles: any = {
    default: "bg-blue-50 text-blue-700 border-blue-200",
    success: "bg-emerald-50 text-emerald-700 border-emerald-200",
    warning: "bg-amber-50 text-amber-700 border-amber-200",
    danger: "bg-red-50 text-red-700 border-red-200",
    outline: "bg-white text-slate-600 border-slate-200",
  };
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold tracking-wide uppercase border ${styles[variant]} ${className}`}>
      {variant !== 'outline' && variant !== 'danger' && <Sparkles className="w-3 h-3" />}
      {children}
    </span>
  );
});
Badge.displayName = 'Badge';

export const SpotlightCard = React.memo(({ children, className = "", onClick }: any) => {
  return (
    <div
      onClick={onClick}
      className={`relative rounded-2xl bg-white border border-slate-200 p-6 md:p-8 shadow-lg shadow-slate-200/50 hover:shadow-xl hover:shadow-slate-300/50 transition-all duration-300 group ${className} ${onClick ? 'cursor-pointer active:scale-[0.99]' : ''}`}
    >
      <div className="relative z-10 h-full flex flex-col">{children}</div>
    </div>
  );
});
SpotlightCard.displayName = 'SpotlightCard';

export const AuroraBackground = React.memo(() => {
  return (
    <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden bg-slate-50">
      <div className="absolute top-[-10%] left-[-10%] w-[50vw] h-[50vw] bg-blue-100/50 rounded-full blur-[100px] mix-blend-multiply opacity-70 animate-pulse" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50vw] h-[50vw] bg-emerald-100/50 rounded-full blur-[100px] mix-blend-multiply opacity-70 animate-pulse delay-700" />
      <div className="absolute top-[40%] left-[40%] w-[30vw] h-[30vw] bg-indigo-100/40 rounded-full blur-[80px] mix-blend-multiply opacity-60" />
      <div className="absolute inset-0 opacity-[0.4]" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%2394a3b8' fill-opacity='0.1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")` }} />
    </div>
  );
});
AuroraBackground.displayName = 'AuroraBackground';