import { Keyboard } from 'lucide-react'
import { Button } from '../ui/Button'

interface Props {
  open: boolean
  onClose: () => void
}

const SHORTCUTS = [
  { keys: 'Alt + ↓', desc: 'Próxima conversa na lista' },
  { keys: 'Alt + ↑', desc: 'Conversa anterior na lista' },
  { keys: 'Alt + A', desc: 'Assumir / aceitar conversa selecionada' },
  { keys: 'Alt + R', desc: 'Focar campo de resposta' },
  { keys: 'Enter', desc: 'Enviar mensagem (no composer)' },
  { keys: 'Shift + Enter', desc: 'Nova linha no composer' },
  { keys: 'Esc', desc: 'Fechar conversa / painéis' },
  { keys: '? ou Ctrl + /', desc: 'Mostrar esta ajuda' },
] as const

export function InboxHotkeysHelp({ open, onClose }: Props) {
  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60"
      role="dialog"
      aria-modal="true"
      aria-labelledby="inbox-hotkeys-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-[var(--rz-border)] bg-[var(--rz-surface)] shadow-xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-[var(--rz-border)] px-4 py-3">
          <Keyboard size={18} className="text-brand-400" />
          <h2 id="inbox-hotkeys-title" className="text-sm font-semibold text-[var(--rz-text-primary)]">
            Atalhos do Inbox
          </h2>
        </div>
        <ul className="divide-y divide-[var(--rz-border)]/60 max-h-[min(70vh,420px)] overflow-y-auto">
          {SHORTCUTS.map(row => (
            <li key={row.keys} className="flex items-start justify-between gap-4 px-4 py-2.5 text-sm">
              <span className="text-[var(--rz-text-secondary)]">{row.desc}</span>
              <kbd className="shrink-0 rounded-md border border-[var(--rz-border)] bg-[var(--rz-surface-muted)] px-2 py-0.5 font-mono text-[11px] text-[var(--rz-text-muted)]">
                {row.keys}
              </kbd>
            </li>
          ))}
        </ul>
        <div className="flex justify-end border-t border-[var(--rz-border)] px-4 py-3">
          <Button size="sm" onClick={onClose}>
            Fechar
          </Button>
        </div>
      </div>
    </div>
  )
}
