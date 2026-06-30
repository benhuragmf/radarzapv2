import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { api } from '../../lib/api'
import { Button } from '../ui/Button'
import { Spinner } from '../ui/Spinner'
import { Eye } from 'lucide-react'
import { inputCls } from '@/design-system'

const PRESETS = [
  { id: 'promo', label: 'Promoção', text: '🔥 Promoção 50% OFF — https://loja.com/promo', hasLink: true, isBot: false },
  { id: 'live', label: 'Live Twitch', text: 'Estou ao vivo!', hasLink: true, isBot: true },
  { id: 'plain', label: 'Texto simples', text: 'Aviso geral no canal', hasLink: false, isBot: false },
] as const

interface PreviewResult {
  matched: boolean
  reason?: string
  ruleName?: string
  templateName?: string
  renderedPreview?: string
  captureKind?: string
}

export interface RulePreviewForm {
  name: string
  triggers: string[]
  templateName: string
  keywords: string
  excludeKeywords: string
  channelIds: string[]
  onlyBots: boolean
  onlyUsers: boolean
  requireLink: boolean
  requireImage: boolean
  requireEmbed: boolean
}

interface Props {
  form: RulePreviewForm
  guildId?: string | null
  guildName?: string | null
}

export function RulePreviewPanel({ form, guildId, guildName }: Props) {
  const [sampleText, setSampleText] = useState('🔥 Promoção especial — https://exemplo.com')
  const [hasLink, setHasLink] = useState(true)
  const [isBot, setIsBot] = useState(false)

  const preview = useMutation({
    mutationFn: () =>
      api.post<PreviewResult>('/rules/preview', {
        name: form.name,
        triggers: form.triggers,
        templateName: form.templateName,
        keywords: form.keywords,
        excludeKeywords: form.excludeKeywords,
        channelIds: form.channelIds,
        onlyBots: form.onlyBots,
        onlyUsers: form.onlyUsers,
        requireLink: form.requireLink,
        requireImage: form.requireImage,
        requireEmbed: form.requireEmbed,
        sample: {
          text: sampleText,
          hasLink,
          isBot,
          guildId: guildId ?? undefined,
          guildName: guildName ?? undefined,
        },
      }),
  })

  if (!form.triggers.includes('message')) return null

  return (
    <div className="rounded-lg border border-dashed border-brand-700/50 bg-brand-950/10 p-4 space-y-3">
      <p className="text-xs font-semibold text-brand-400 flex items-center gap-1.5">
        <Eye size={14} /> Prévia da regra (não envia ao WhatsApp)
      </p>

      <div className="flex flex-wrap gap-2">
        {PRESETS.map(p => (
          <button
            key={p.id}
            type="button"
            onClick={() => {
              setSampleText(p.text)
              setHasLink(p.hasLink)
              setIsBot(p.isBot)
            }}
            className="text-[10px] px-2 py-1 rounded border border-[var(--rz-border)] text-[var(--rz-text-muted)] hover:border-brand-500/50"
          >
            {p.label}
          </button>
        ))}
      </div>

      <textarea
        value={sampleText}
        onChange={e => setSampleText(e.currentTarget.value)}
        rows={3}
        className={inputCls}
        placeholder="Cole aqui um exemplo de mensagem do Discord..."
      />

      <div className="flex flex-wrap gap-3 text-xs">
        <label className="flex items-center gap-1.5 text-[var(--rz-text-secondary)]">
          <input type="checkbox" checked={hasLink} onChange={e => setHasLink(e.target.checked)} />
          Tem link
        </label>
        <label className="flex items-center gap-1.5 text-[var(--rz-text-secondary)]">
          <input type="checkbox" checked={isBot} onChange={e => setIsBot(e.target.checked)} />
          Mensagem de bot
        </label>
      </div>

      <Button
        size="sm"
        variant="ghost"
        onClick={() => preview.mutate()}
        disabled={!sampleText.trim() || preview.isPending}
      >
        {preview.isPending ? <Spinner size={12} /> : <Eye size={12} />}
        Testar regra
      </Button>

      {preview.data && (
        <div className="text-xs space-y-2 pt-2 border-t border-[var(--rz-border)]">
          {preview.data.matched ? (
            <>
              <p className="text-green-400">
                ✓ Bate na regra <strong>{preview.data.ruleName}</strong>
                {preview.data.templateName && ` · template ${preview.data.templateName}`}
              </p>
              {preview.data.renderedPreview && (
                <pre className="whitespace-pre-wrap rounded bg-[var(--rz-surface-muted)] p-3 text-[var(--rz-text-secondary)] max-h-48 overflow-y-auto text-[11px]">
                  {preview.data.renderedPreview}
                </pre>
              )}
            </>
          ) : (
            <p className="text-amber-400/90">✗ {preview.data.reason ?? 'Não bateu'}</p>
          )}
        </div>
      )}
    </div>
  )
}
