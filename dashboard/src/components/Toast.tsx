import { createContext, ReactNode, useCallback, useContext, useRef, useState } from 'react';

type Toast = { text: string; error?: boolean } | null;
const Ctx = createContext<(text: string, error?: boolean) => void>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<Toast>(null);
  const timer = useRef<number | undefined>(undefined);
  const show = useCallback((text: string, error = false) => {
    setToast({ text, error });
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setToast(null), error ? 5000 : 2500);
  }, []);
  return (
    <Ctx.Provider value={show}>
      {children}
      {toast && (
        <div className={`toast${toast.error ? ' error' : ''}`} role="status">
          {toast.text}
        </div>
      )}
    </Ctx.Provider>
  );
}

export const useToast = () => useContext(Ctx);
