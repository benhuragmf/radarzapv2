import { useState } from 'react'
import { ClipboardCopy, ExternalLink, Code2, MessageSquare, Eye } from 'lucide-react'
import { Button } from '../ui/Button'
import { Card } from '../ui/Card'
import { notifySuccess } from '../../lib/notify'
import {
  WEBCHAT_INTEGRATION_METHODS,
  webchatPreviewPageUrl,
  webchatPublicApiBase,
  webchatSnippetForMethod,
  webchatWidgetScriptSnippet,
  type WebChatIntegrationMethod,
} from '../../lib/webchatIntegrationSnippets'
import { panelOrigin } from '../../lib/leadIntegrationSnippets'

function CopyBlock({ code, label }: { code: string; label: string }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-[var(--rz-text-secondary)]">{label}</p>
        <Button
          size="sm"
          variant="secondary"
          onClick={() => {
            void navigator.clipboard.writeText(code)
            notifySuccess('Copiado')
          }}
        >
          <ClipboardCopy size={14} /> Copiar
        </Button>
      </div>
      <pre className="text-xs p-3 rounded-lg bg-[var(--rz-surface-muted)] overflow-x-auto max-h-72 overflow-y-auto whitespace-pre-wrap">
        {code}
      </pre>
    </div>
  )
}

type Props = {
  publicKey: string
  name: string
  active: boolean
  showPreview?: boolean
}

export function WebChatIntegrationsPanel({ publicKey, name, active, showPreview: showPreviewDefault = true }: Props) {
  const origin = panelOrigin()
  const [method, setMethod] = useState<WebChatIntegrationMethod>('embed')
  const [sub, setSub] = useState('default')
  const [showPreview, setShowPreview] = useState(showPreviewDefault)

  const previewUrl = webchatPreviewPageUrl(publicKey, origin)
  const apiBase = webchatPublicApiBase(origin)
  const embedSnippet = webchatWidgetScriptSnippet(publicKey, origin)

  const subTabs: Record<WebChatIntegrationMethod, Array<{ id: string; label: string }>> = {
    embed: [{ id: 'default', label: 'Script automático' }],
    api: [
      { id: 'fetch', label: 'JavaScript (sessão)' },
      { id: 'curl', label: 'cURL / config' },
    ],
    html: [{ id: 'default', label: 'Página exemplo' }],
    wordpress: [{ id: 'default', label: 'Bloco HTML' }],
    builders: [{ id: 'default', label: 'Guia rápido' }],
  }

  const subKey = method === 'api' ? (sub === 'curl' ? 'curl' : 'fetch') : 'default'

  return (
    <div className="space-y-6">
      <Card className="space-y-3 bg-[var(--rz-primary)]/5 border-[var(--rz-primary)]/20">
        <div className="flex items-start gap-3">
          <MessageSquare className="shrink-0 text-[var(--rz-primary)] mt-0.5" size={20} />
          <div>
            <h2 className="font-semibold text-sm">Instale o chat em qualquer site</h2>
            <p className="text-sm text-[var(--rz-text-muted)] mt-1 leading-relaxed">
              Use o widget pronto Radar Chat (recomendado) ou integre via API em landings, WordPress e
              construtores de página.
            </p>
          </div>
        </div>
      </Card>

      <Card className="space-y-3">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 text-sm">
          <div>
            <p className="text-xs text-[var(--rz-text-muted)]">Widget</p>
            <p className="font-medium mt-1">{name}</p>
          </div>
          <div>
            <p className="text-xs text-[var(--rz-text-muted)]">Chave</p>
            <p className="font-mono text-xs mt-1 break-all">{publicKey}</p>
          </div>
          <div>
            <p className="text-xs text-[var(--rz-text-muted)]">Status</p>
            <p className="mt-1">{active ? 'Ativo' : 'Inativo'}</p>
          </div>
          <div className="flex flex-wrap gap-2 items-end">
            <Button size="sm" variant="secondary" onClick={() => setShowPreview(v => !v)}>
              <Eye size={14} /> {showPreview ? 'Ocultar' : 'Mostrar'} prévia
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                void navigator.clipboard.writeText(embedSnippet)
                notifySuccess('Script copiado')
              }}
            >
              <ClipboardCopy size={14} /> Copiar script
            </Button>
          </div>
        </div>
      </Card>

      {showPreview && active && (
        <Card className="space-y-2">
          <p className="text-sm font-medium flex items-center gap-2">
            <Eye size={16} /> Pré-visualização ao vivo
          </p>
          <iframe
            title={`Preview ${name}`}
            src={previewUrl}
            className="w-full min-h-[420px] rounded-lg border border-[var(--rz-border)] bg-white"
            sandbox="allow-scripts allow-forms allow-same-origin"
          />
        </Card>
      )}

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-4">
          <div className="space-y-1">
            {WEBCHAT_INTEGRATION_METHODS.map(m => (
              <button
                key={m.id}
                type="button"
                onClick={() => {
                  setMethod(m.id)
                  setSub('default')
                }}
                className={`w-full text-left rounded-lg border px-3 py-2.5 transition-colors ${
                  method === m.id
                    ? 'border-[var(--rz-primary)] bg-[var(--rz-primary)]/10'
                    : 'border-[var(--rz-border)] hover:border-[var(--rz-primary)]/40'
                }`}
              >
                <p className="text-sm font-medium">{m.label}</p>
                <p className="text-xs text-[var(--rz-text-muted)] mt-0.5">{m.description}</p>
              </button>
            ))}
          </div>
        </div>

        <div className="lg:col-span-2 space-y-4">
          {!active && (
            <div className="text-sm text-amber-800 dark:text-amber-200 bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-2">
              Este widget está inativo — ative em Visão geral para exibir no site.
            </div>
          )}

          {subTabs[method].length > 1 && (
            <div className="flex flex-wrap gap-2">
              {subTabs[method].map(t => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setSub(t.id)}
                  className={`text-xs px-3 py-1.5 rounded-full border ${
                    sub === t.id
                      ? 'border-[var(--rz-primary)] bg-[var(--rz-primary)]/10 text-[var(--rz-primary)]'
                      : 'border-[var(--rz-border)] text-[var(--rz-text-secondary)]'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          )}

          <CopyBlock
            label="Código / instruções"
            code={webchatSnippetForMethod(method, publicKey, origin, subKey)}
          />

          <Card className="space-y-2 text-sm">
            <p className="font-medium flex items-center gap-2">
              <Code2 size={16} /> Endpoints deste widget
            </p>
            <dl className="space-y-2 text-xs font-mono break-all">
              <div>
                <dt className="text-[var(--rz-text-muted)] font-sans">Config (GET)</dt>
                <dd>{apiBase}/widgets/{publicKey}/config</dd>
              </div>
              <div>
                <dt className="text-[var(--rz-text-muted)] font-sans">Abrir sessão (POST)</dt>
                <dd>{apiBase}/widgets/{publicKey}/sessions</dd>
              </div>
              <div>
                <dt className="text-[var(--rz-text-muted)] font-sans">Preview</dt>
                <dd>
                  <a
                    href={previewUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[var(--rz-primary)] inline-flex items-center gap-1"
                  >
                    {previewUrl} <ExternalLink size={12} />
                  </a>
                </dd>
              </div>
            </dl>
          </Card>
        </div>
      </div>
    </div>
  )
}
