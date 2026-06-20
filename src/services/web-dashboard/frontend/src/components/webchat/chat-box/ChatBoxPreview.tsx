import { cn } from '@/lib/utils'
import type { ChatBoxModel } from '@/lib/chatBoxModels'
import { Lock, Minus, Paperclip, Send, X, Zap } from 'lucide-react'

type PreviewSize = 'card' | 'modal'

function HeaderActions({ dark }: { dark?: boolean }) {
  return (
    <div className="flex items-center gap-1" aria-hidden="true">
      <span
        className={cn(
          'flex h-5 w-5 items-center justify-center rounded-full border text-[9px]',
          dark ? 'border-white/25 text-white/80' : 'border-slate-300 text-slate-500',
        )}
      >
        <Minus className="h-2.5 w-2.5" />
      </span>
      <span
        className={cn(
          'flex h-5 w-5 items-center justify-center rounded-full border text-[9px]',
          dark ? 'border-white/25 text-white/80' : 'border-slate-300 text-slate-500',
        )}
      >
        <X className="h-2.5 w-2.5" />
      </span>
    </div>
  )
}

function MessageBubble({
  text,
  role,
  dark,
}: {
  text: string
  role: 'user' | 'bot'
  dark?: boolean
}) {
  return (
    <div
      className={cn(
        'rounded-xl px-2.5 py-1.5 text-[9px] leading-snug',
        role === 'user'
          ? dark
            ? 'bg-slate-700 text-slate-100'
            : 'bg-slate-100 text-slate-800'
          : dark
            ? 'bg-slate-800/80 text-slate-200'
            : 'bg-white text-slate-700 shadow-sm border border-slate-100',
      )}
    >
      {text}
    </div>
  )
}

function InputRow({
  model,
  size,
}: {
  model: ChatBoxModel
  size: PreviewSize
}) {
  const t = model.theme
  const h = size === 'modal' ? model.dimensions.inputHeight : model.dimensions.inputHeight - 8
  return (
    <div
      className="flex items-center gap-1.5 border-t px-2 py-1.5"
      style={{ borderColor: t.border, background: t.background }}
    >
      {model.preview.showAttachment && (
        <Paperclip className="h-3 w-3 shrink-0" style={{ color: t.muted }} aria-hidden="true" />
      )}
      <div
        className="flex-1 truncate text-[8px]"
        style={{ color: t.muted, minHeight: h - 16 }}
      >
        {model.preview.inputPlaceholder}
      </div>
      <span
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-white"
        style={{ background: t.primary }}
      >
        <Send className="h-3 w-3" />
      </span>
    </div>
  )
}

function PreviewBody({ model, size }: { model: ChatBoxModel; size: PreviewSize }) {
  const p = model.preview
  const t = model.theme
  const textSize = size === 'modal' ? 'text-[11px]' : 'text-[9px]'

  return (
    <div
      className={cn('flex flex-1 flex-col gap-1.5 overflow-hidden p-2', textSize)}
      style={{ background: t.isDark ? t.background : t.surface || t.background, color: t.text }}
    >
      {p.messages?.map((m, i) => (
        <MessageBubble key={i} text={m.text} role={m.role} dark={t.isDark} />
      ))}

      {p.introLines?.map(line => (
        <p key={line} className="leading-snug" style={{ color: t.text }}>{line}</p>
      ))}

      {p.primaryCta && (
        <button
          type="button"
          className="w-full rounded-lg py-1.5 text-[9px] font-semibold text-white"
          style={{ background: t.primary }}
        >
          {p.primaryCta}
        </button>
      )}

      {p.searchPlaceholder && (
        <div
          className="rounded-lg border px-2 py-1 text-[8px]"
          style={{ borderColor: t.border, color: t.muted, background: t.background }}
        >
          {p.searchPlaceholder}
        </div>
      )}

      {p.chips && p.chips.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {p.chips.map(chip => (
            <span
              key={chip}
              className="rounded-full border px-2 py-0.5 text-[8px] font-medium"
              style={{ borderColor: t.border, background: t.background, color: t.text }}
            >
              {chip}
            </span>
          ))}
        </div>
      )}

      {p.quickActions && (
        <div className="flex flex-col gap-1">
          {p.quickActions.map(action => (
            <button
              key={action}
              type="button"
              className="rounded-lg border px-2 py-1 text-left text-[8px] font-medium"
              style={{ borderColor: t.border, background: t.background, color: t.text }}
            >
              {action}
            </button>
          ))}
        </div>
      )}

      {p.faqTitle && (
        <div>
          <p className="mb-1 text-[8px] font-semibold" style={{ color: t.muted }}>{p.faqTitle}</p>
          <div className="space-y-0.5">
            {p.faqItems?.map(item => (
              <div
                key={item}
                className="rounded-md border px-2 py-1 text-[8px]"
                style={{ borderColor: t.border, background: t.background }}
              >
                {item}
              </div>
            ))}
          </div>
        </div>
      )}

      {p.actionRows && (
        <div className="space-y-1">
          {p.actionRows.map(row => (
            <button
              key={row}
              type="button"
              className="w-full rounded-lg border px-2 py-1.5 text-left text-[8px] font-medium"
              style={{ borderColor: t.border, background: t.background, color: t.text }}
            >
              {row}
            </button>
          ))}
        </div>
      )}

      {p.tiles && (
        <div className="grid grid-cols-2 gap-1">
          {p.tiles.map(tile => (
            <div
              key={tile}
              className="rounded-lg border px-1.5 py-2 text-center text-[7px] font-medium leading-tight"
              style={{
                borderColor: t.border,
                background: t.isDark ? t.surface : '#F0FDFA',
                color: t.text,
              }}
            >
              {tile}
            </div>
          ))}
        </div>
      )}

      {p.suggestionsTitle && (
        <div
          className="rounded-lg border p-2"
          style={{ borderColor: t.border, background: t.isDark ? t.surface : '#F5F3FF' }}
        >
          <p className="text-[8px] font-semibold" style={{ color: t.text }}>{p.suggestionsTitle}</p>
          {p.suggestionsSubtitle && (
            <p className="mt-0.5 text-[7px]" style={{ color: t.muted }}>{p.suggestionsSubtitle}</p>
          )}
          <div className="mt-1.5 flex flex-wrap gap-1">
            {p.suggestions?.map(s => (
              <span
                key={s}
                className="rounded-full border px-2 py-0.5 text-[7px]"
                style={{ borderColor: t.border, background: t.background }}
              >
                {s}
              </span>
            ))}
          </div>
        </div>
      )}

      {p.infoLine && (
        <p className="text-[7px]" style={{ color: t.muted }}>{p.infoLine}</p>
      )}
    </div>
  )
}

export function ChatBoxPreview({
  model,
  size = 'card',
  className,
}: {
  model: ChatBoxModel
  size?: PreviewSize
  className?: string
}) {
  const t = model.theme
  const p = model.preview
  const w = size === 'modal' ? model.dimensions.widgetWidth : model.dimensions.previewWidth
  const h = size === 'modal' ? model.dimensions.widgetHeight : model.dimensions.previewHeight
  const radius = model.dimensions.borderRadius
  const isGlass = p.variant === 'floating-mini'

  if (p.showFloatingBubble && size === 'card') {
    return (
      <div className={cn('relative flex items-end justify-end', className)} style={{ height: h }}>
        <div
          className="absolute bottom-0 right-0 flex h-10 w-10 items-center justify-center rounded-full shadow-lg"
          style={{
            background: `linear-gradient(135deg, ${t.primary}, ${t.accent ?? '#EC4899'})`,
          }}
          aria-hidden="true"
        >
          <Zap className="h-4 w-4 text-white" />
        </div>
        <div
          className="mb-12 mr-1 flex flex-col overflow-hidden shadow-xl"
          style={{
            width: w - 20,
            height: h - 48,
            borderRadius: radius,
            border: isGlass ? `1px solid ${t.border}` : `1px solid ${t.border}`,
            background: isGlass ? t.background : t.background,
            backdropFilter: isGlass ? 'blur(16px)' : undefined,
          }}
        >
          <ChatBoxPreviewInner model={model} size={size} />
        </div>
      </div>
    )
  }

  return (
    <div
      className={cn('mx-auto flex flex-col overflow-hidden shadow-lg', className)}
      style={{
        width: w,
        maxWidth: '100%',
        height: h,
        borderRadius: radius,
        border: `1px solid ${t.border}`,
        background: isGlass ? t.background : t.background,
        backdropFilter: isGlass ? 'blur(14px)' : undefined,
      }}
      role="img"
      aria-label={`Preview do modelo ${model.name}`}
    >
      <ChatBoxPreviewInner model={model} size={size} />
    </div>
  )
}

function ChatBoxPreviewInner({ model, size }: { model: ChatBoxModel; size: PreviewSize }) {
  const t = model.theme
  const p = model.preview
  const headerDark = t.isDark || p.variant === 'smart-mini' || p.variant === 'mini-corporate'

  return (
    <>
      <div
        className="flex items-center gap-2 px-2.5 py-2"
        style={{
          background: t.headerBg,
          color: headerDark ? '#F8FAFC' : t.text,
          minHeight: size === 'modal' ? model.dimensions.headerHeight : model.dimensions.headerHeight - 8,
        }}
      >
        <div
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold"
          style={{
            background: headerDark ? 'rgba(255,255,255,0.15)' : t.primary,
            color: '#fff',
          }}
        >
          {p.variant === 'mini-corporate' ? (
            <Lock className="h-3.5 w-3.5" />
          ) : (
            'RZ'
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[10px] font-semibold leading-tight">{p.headerTitle}</p>
          {(p.headerSubtitle || p.headerStatus) && (
            <p className="truncate text-[8px] opacity-80">
              {p.headerSubtitle || p.headerStatus}
            </p>
          )}
        </div>
        <HeaderActions dark={headerDark} />
      </div>

      <PreviewBody model={model} size={size} />

      {p.showBottomNav && (
        <div
          className="flex justify-around border-t px-1 py-1 text-[7px]"
          style={{ borderColor: t.border, color: t.muted }}
        >
          <span>Início</span>
          <span style={{ color: t.primary }}>Chat</span>
          <span>Ajuda</span>
        </div>
      )}

      {p.footer && (
        <p className="px-2 py-1 text-center text-[7px]" style={{ color: t.muted, background: t.background }}>
          {p.footer}
        </p>
      )}

      <InputRow model={model} size={size} />
    </>
  )
}
