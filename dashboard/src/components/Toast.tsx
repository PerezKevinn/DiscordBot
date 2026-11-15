/** Avisos breves (toasts) del panel: un único aviso visible a la vez. */
import { createContext, ReactNode, useCallback, useContext, useRef, useState } from 'react';

type Toast = { text: string; error?: boolean } | null;
const Ctx = createContext<(text: string, error?: boolean) => void>(() => {});

/** Proveedor de los avisos; envuelve la aplicación. Los errores se muestran más tiempo. */
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

/** Devuelve la función para mostrar un aviso: toast(texto, esError). */
export const useToast = () => useContext(Ctx);
