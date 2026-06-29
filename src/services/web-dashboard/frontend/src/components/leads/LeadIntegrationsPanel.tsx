import { useMemo, useState, useEffect } from 'react'
import { ClipboardCopy, ExternalLink, Code2, Globe, Eye, Save } from 'lucide-react'
import { Button } from '../ui/Button'
import { Card } from '../ui/Card'
import { notifySuccess } from '../../lib/notify'
import { inputCls, textareaCls } from '@/design-system'
import { EmbedSitesSection } from '../embed/EmbedSitesSection'
import {
  LEAD_INTEGRATION_METHODS,
  leadPublicApiBase,
  panelOrigin,
  snippetForMethod,
  type LeadIntegrationMethod,
} from '../../lib/leadIntegrationSnippets'

type FormOption = {
  id: string
  name: string
  publicKey: string
  active: boolean
  allowedDomains?: string[]
  includeCompanyWebsite?: boolean
  routing?: { defaultContactGroupIds?: string[] }
}

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

export function LeadIntegrationsPanel({
  forms,
  readOnly = false,
  companyWebsite,
  onSaveDomains,
  domainsPending = false,
  hideDomains = false,
  hideFormPicker = false,
  hidePreview = false,
}: {
  forms: FormOption[]
  readOnly?: boolean
  companyWebsite?: string
  onSaveDomains?: (
    formId: string,
    patch: { allowedDomains: string[]; includeCompanyWebsite: boolean },
  ) => void
  domainsPending?: boolean
  /** Domínios ficam na Visão geral do editor — não repetir aqui */
  hideDomains?: boolean
  /** Um formulário por vez no editor embutido */
  hideFormPicker?: boolean
  /** Prévia fica no painel lateral do editor */
  hidePreview?: boolean
}) {
  const origin = panelOrigin()
  const activeForms = forms.filter(f => f.active)
  const [formId, setFormId] = useState(activeForms[0]?.id ?? forms[0]?.id ?? '')
  const [method, setMethod] = useState<LeadIntegrationMethod>('embed')
  const [sub, setSub] = useState('default')
  const [showPreview, setShowPreview] = useState(true)
  const [domainDraft, setDomainDraft] = useState({
    includeCompanyWebsite: true,
    allowedDomains: [] as string[],
  })

  const form = useMemo(
    () => forms.find(f => f.id === formId) ?? activeForms[0] ?? forms[0] ?? null,
    [formId, forms, activeForms],
  )

  useEffect(() => {
    if (!form) return
    setDomainDraft({
      includeCompanyWebsite: form.includeCompanyWebsite !== false,
      allowedDomains: form.allowedDomains ?? [],
    })
  }, [form])

  if (!forms.length) {
    return (
      <Card>
        <p className="text-sm text-[var(--rz-text-muted)]">
          {readOnly
            ? 'Nenhum formulário disponível. Peça ao administrador para criar um em Formulários.'
            : 'Crie um formulário na aba Formulários para gerar códigos de integração.'}
        </p>
      </Card>
    )
  }

  if (!form) return null

  const domainsDirty =
    domainDraft.includeCompanyWebsite !== (form.includeCompanyWebsite !== false) ||
    domainDraft.allowedDomains.join('\n') !== (form.allowedDomains ?? []).join('\n')

  const previewUrl = `${origin}/leads/preview.html?key=${encodeURIComponent(form.publicKey)}`
  const apiSubmit = `${leadPublicApiBase(origin)}/forms/${form.publicKey}/submit`
  const embedSnippet = snippetForMethod('embed', form.publicKey, origin)

  const subTabs: Record<LeadIntegrationMethod, Array<{ id: string; label: string }>> = {
    embed: [
      { id: 'default', label: 'Script automático' },
      { id: 'container', label: 'Dentro de uma div' },
    ],
    api: [
      { id: 'fetch', label: 'JavaScript (fetch)' },
      { id: 'curl', label: 'cURL / teste' },
    ],
    html: [{ id: 'default', label: 'Exemplo completo' }],
    wordpress: [
      { id: 'default', label: 'Bloco HTML' },
      { id: 'cf7', label: 'Contact Form 7' },
      { id: 'footer', label: 'Rodapé global' },
    ],
    builders: [{ id: 'default', label: 'Guia rápido' }],
  }

  const subKey = method === 'api' ? (sub === 'curl' ? 'curl' : 'fetch') : sub === 'container' ? 'container' : sub

  return (
    <div className="space-y-6">
      {!hideDomains && (
        <Card className="space-y-4 border-[var(--rz-primary)]/25" id="embed-sites">
          <EmbedSitesSection
            title="Sites onde este formulário pode aparecer"
            description="Primeiro passo antes de copiar o script. O site em Configurações → Empresa entra automaticamente quando marcado abaixo."
            includeCompanyWebsite={domainDraft.includeCompanyWebsite}
            onIncludeCompanyWebsiteChange={checked =>
              setDomainDraft(d => ({ ...d, includeCompanyWebsite: checked }))
            }
            extraDomains={domainDraft.allowedDomains}
            onExtraDomainsChange={domains => setDomainDraft(d => ({ ...d, allowedDomains: domains }))}
            companyWebsite={companyWebsite}
            textareaCls={textareaCls}
            id="lead-integrate-extra-domains"
          />
          {!readOnly && onSaveDomains && (
            <Button
              size="sm"
              disabled={!domainsDirty || domainsPending}
              onClick={() =>
                onSaveDomains(form.id, {
                  allowedDomains: domainDraft.allowedDomains,
                  includeCompanyWebsite: domainDraft.includeCompanyWebsite,
                })
              }
            >
              <Save size={14} /> Salvar domínios
            </Button>
          )}
        </Card>
      )}

      <Card className="space-y-3 bg-[var(--rz-primary)]/5 border-[var(--rz-primary)]/20">
        <div className="flex items-start gap-3">
          <Globe className="shrink-0 text-[var(--rz-primary)] mt-0.5" size={20} />
          <div>
            <h2 className="font-semibold text-sm">Capture leads em qualquer site ou formulário</h2>
            <p className="text-sm text-[var(--rz-text-muted)] mt-1 leading-relaxed">
              Use o formulário pronto Radar Chat (recomendado) ou conecte WordPress, Elementor, landing pages e
              formulários próprios via API.
            </p>
          </div>
        </div>
      </Card>

      <Card className="space-y-3">
        <div
          className={`grid gap-3 text-sm ${hideFormPicker ? 'sm:grid-cols-2 lg:grid-cols-3' : 'sm:grid-cols-2 lg:grid-cols-4'}`}
        >
          {!hideFormPicker && (
            <div>
              <label className="text-xs text-[var(--rz-text-muted)]">Formulário</label>
              <select className={inputCls + ' mt-1'} value={form.id} onChange={e => setFormId(e.target.value)}>
                {forms.map(f => (
                  <option key={f.id} value={f.id}>
                    {f.name} {!f.active ? '(inativo)' : ''}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div>
            <p className="text-xs text-[var(--rz-text-muted)]">Chave</p>
            <p className="font-mono text-xs mt-1 break-all">{form.publicKey}</p>
          </div>
          <div>
            <p className="text-xs text-[var(--rz-text-muted)]">Status</p>
            <p className="mt-1">{form.active ? 'Ativo' : 'Inativo'}</p>
          </div>
          <div className="flex flex-wrap gap-2 items-end">
            {!hidePreview && (
              <Button size="sm" variant="secondary" onClick={() => setShowPreview(v => !v)}>
                <Eye size={14} /> {showPreview ? 'Ocultar' : 'Mostrar'} prévia
              </Button>
            )}
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

      {showPreview && !hidePreview && form.active && (
        <Card className="space-y-2">
          <p className="text-sm font-medium flex items-center gap-2">
            <Eye size={16} /> Pré-visualização ao vivo
          </p>
          <iframe
            title={`Preview ${form.name}`}
            src={previewUrl}
            className="w-full min-h-[420px] rounded-lg border border-[var(--rz-border)] bg-white"
            sandbox="allow-scripts allow-forms allow-same-origin"
          />
        </Card>
      )}

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-4">
          <div className="space-y-1">
            {LEAD_INTEGRATION_METHODS.map(m => (
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
          {!form.active && (
            <div className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              Este formulário está inativo — ative na Visão geral para receber leads.
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
            code={snippetForMethod(method, form.publicKey, origin, subKey === 'fetch' ? undefined : subKey)}
          />

          <Card className="space-y-2 text-sm">
            <p className="font-medium flex items-center gap-2">
              <Code2 size={16} /> Endpoints deste formulário
            </p>
            <dl className="space-y-2 text-xs font-mono break-all">
              <div>
                <dt className="text-[var(--rz-text-muted)] font-sans">Enviar lead (POST)</dt>
                <dd>{apiSubmit}</dd>
              </div>
              <div>
                <dt className="text-[var(--rz-text-muted)] font-sans">Preview</dt>
                <dd>
                  <a href={previewUrl} target="_blank" rel="noreferrer" className="text-[var(--rz-primary)] inline-flex items-center gap-1">
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
