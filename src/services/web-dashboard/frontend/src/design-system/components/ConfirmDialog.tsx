import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/shadcn/dialog'
import { themeClasses } from '../theme'

interface ConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  confirmLabel?: string
  cancelLabel?: string
  onConfirm: () => void
  onCancel?: () => void
  loading?: boolean
  variant?: 'default' | 'danger'
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  onConfirm,
  onCancel,
  loading,
  variant = 'default',
}: ConfirmDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={!loading}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>
        <DialogFooter>
          <button
            type="button"
            className={themeClasses.btnSecondary}
            disabled={loading}
            onClick={() => {
              onCancel?.()
              onOpenChange(false)
            }}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className={variant === 'danger' ? themeClasses.btnDanger : themeClasses.btnPrimary}
            disabled={loading}
            onClick={onConfirm}
          >
            {loading ? 'Aguarde…' : confirmLabel}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
