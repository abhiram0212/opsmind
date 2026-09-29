import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { Check, CircleAlert, Info, X } from 'lucide-react';

type ToastType = 'success' | 'error' | 'info';
interface ToastValue { showToast: (message: string, type?: ToastType) => void }
const ToastContext = createContext<ToastValue | null>(null);

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used inside ToastProvider.');
  return context.showToast;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);
  const showToast = useCallback((message: string, type: ToastType = 'success') => {
    setToast({ message, type });
    window.setTimeout(() => setToast(null), 3600);
  }, []);
  const value = useMemo(() => ({ showToast }), [showToast]);
  const Icon = toast?.type === 'error' ? CircleAlert : toast?.type === 'info' ? Info : Check;
  return <ToastContext.Provider value={value}>{children}{toast && <div className={`toast toast-${toast.type}`} role="status"><Icon size={17} />{toast.message}<button aria-label="Dismiss notification" onClick={() => setToast(null)}><X size={15} /></button></div>}</ToastContext.Provider>;
}