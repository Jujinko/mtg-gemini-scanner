import React, { createContext, useContext, useState, ReactNode } from 'react';

type ToastType = 'success' | 'error' | 'info';

interface ToastAction {
  label: string;
  onClick: () => void;
}

interface Toast {
  id: string;
  message: string;
  type: ToastType;
  action?: ToastAction;
}

interface ToastContextType {
  toasts: Toast[];
  showToast: (message: string, type?: ToastType, action?: ToastAction) => void;
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = (message: string, type: ToastType = 'info', action?: ToastAction) => {
    const id = crypto.randomUUID();
    setToasts((prev) => [...prev, { id, message, type, action }]);
    setTimeout(() => {
      removeToast(id);
    }, 4000);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  };

  return (
    <ToastContext.Provider value={{ toasts, showToast, removeToast }}>
      {children}
      <div 
        className="fixed top-4 sm:top-8 left-1/2 -translate-x-1/2 z-[100] flex flex-col gap-2 w-full max-w-sm px-4 pointer-events-none"
        style={{ marginTop: 'env(safe-area-inset-top)' }}
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`px-4 py-3 bg-zinc-900 border rounded-2xl shadow-2xl flex items-center gap-3 pointer-events-auto transition-all ${
              toast.type === 'error'
                ? 'border-red-900/50'
                : toast.type === 'success'
                ? 'border-emerald-900/50'
                : 'border-zinc-800'
            }`}
          >
            {toast.type === 'success' && (
               <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)] shrink-0"></div>
            )}
            {toast.type === 'error' && (
               <div className="w-2 h-2 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)] shrink-0"></div>
            )}
            {toast.type === 'info' && (
               <div className="w-2 h-2 rounded-full bg-zinc-500 shrink-0"></div>
            )}
            <span className="text-xs font-medium text-zinc-300 flex-1">{toast.message}</span>
            {toast.action && (
              <button
                onClick={() => {
                  toast.action!.onClick();
                  removeToast(toast.id);
                }}
                className="text-[10px] font-bold uppercase tracking-widest text-emerald-400 hover:text-emerald-300 shrink-0 px-2 py-1 bg-emerald-500/10 rounded-lg transition-colors"
              >
                {toast.action.label}
              </button>
            )}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}
