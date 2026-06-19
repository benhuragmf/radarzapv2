import { cn } from '@/lib/utils'
import type { ThemeMode } from '@/context/ThemeContext'

/** Classes Tailwind reutilizáveis baseadas nos tokens CSS `--rz-*`. */
export const themeClasses = {
  page: 'bg-[var(--rz-background)] text-[var(--rz-text-primary)]',
  surface: 'bg-[var(--rz-surface)] border border-[var(--rz-border)]',
  surfaceMuted: 'bg-[var(--rz-surface-muted)]',
  textPrimary: 'text-[var(--rz-text-primary)]',
  textSecondary: 'text-[var(--rz-text-secondary)]',
  textMuted: 'text-[var(--rz-text-muted)]',
  card: 'rounded-xl border border-[var(--rz-border)] bg-[var(--rz-surface)] shadow-[var(--rz-shadow-card)]',
  cardPadding: 'p-5',
  focusRing: 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rz-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--rz-background)]',
  btnPrimary:
    'inline-flex items-center justify-center gap-1.5 rounded-lg bg-[var(--rz-primary)] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[var(--rz-primary-hover)] disabled:opacity-50 disabled:cursor-not-allowed',
  btnSecondary:
    'inline-flex items-center justify-center gap-1.5 rounded-lg border border-[var(--rz-border)] bg-[var(--rz-surface)] px-4 py-2 text-sm font-medium text-[var(--rz-text-primary)] transition-colors hover:bg-[var(--rz-surface-muted)] disabled:opacity-50 disabled:cursor-not-allowed',
  btnDanger:
    'inline-flex items-center justify-center gap-1.5 rounded-lg bg-[var(--rz-danger)] px-4 py-2 text-sm font-medium text-white transition-colors hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed',
  btnGhost:
    'inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-[var(--rz-text-secondary)] transition-colors hover:bg-[var(--rz-surface-muted)] hover:text-[var(--rz-text-primary)] disabled:opacity-50 disabled:cursor-not-allowed',
  input:
    'w-full rounded-lg border border-[var(--rz-border)] bg-[var(--rz-surface)] px-3 py-2 text-sm text-[var(--rz-text-primary)] placeholder:text-[var(--rz-text-muted)] focus:border-[var(--rz-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--rz-primary)]/20',
} as const

export function themed(className: string, mode?: ThemeMode): string {
  return cn(className, mode === 'light' && 'rz-theme-light', mode === 'dark' && 'rz-theme-dark')
}

export function pageShellClassName(className?: string): string {
  return cn('w-full space-y-6', className)
}

/** Largura máxima das páginas de plataforma/atendimento — alinhada ao Inbox (`max-w-[1600px]`). */
export const platformPageMaxWidthClass = 'max-w-[1600px]'

export function dashboardGridClassName(className?: string): string {
  return cn('grid gap-4 sm:grid-cols-2 xl:grid-cols-4', className)
}
