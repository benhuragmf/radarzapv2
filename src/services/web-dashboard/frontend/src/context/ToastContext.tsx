import { type ReactNode } from 'react'

/** Legado — toasts globais via Sonner em `main.tsx`; este provider não renderiza stack duplicada. */
export function ToastProvider({ children }: { children: ReactNode }) {
  return <>{children}</>
}
