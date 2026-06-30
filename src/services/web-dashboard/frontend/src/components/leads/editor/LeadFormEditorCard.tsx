import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { notifySuccess } from '@/lib/notify'
import { inputCls, textareaCls } from '@/design-system'
import { EmbedSitesSection } from '@/components/embed/EmbedSitesSection'
import { LeadFormFieldsEditor } from '@/components/leads/LeadFormFieldsEditor'
import { LeadIntegrationsPanel } from '@/components/leads/LeadIntegrationsPanel'
import { LeadFormEditorHeader } from '@/components/leads/editor/LeadFormEditorHeader'
import { LeadFormOverview } from '@/components/leads/editor/LeadFormOverview'
import { LeadFormPreviewPanel } from '@/components/leads/editor/LeadFormPreviewPanel'
import {
  LeadFormEditorSection,
  LeadFormSectionCard,
  LeadFormSectionNav,
  LeadFormSectionNavCompact,
} from '@/components/leads/editor/LeadFormEditorSection'
import { WebChatWidgetSaveBar } from '@/components/webchat/editor/WebChatWidgetSaveBar'
import { ProductBrandingFooterToggle } from '@/components/shared/ProductBrandingFooterToggle'
import { resolveProductBrandingVisible } from '@/lib/brandingPlan'
import { embedScriptSnippet } from '@/lib/leadIntegrationSnippets'
import {
  getLeadFormSectionStatuses,
  isLeadFormDirty,
  loadLeadFormPreviewSection,
  saveLeadFormPreviewSection,
  type LeadFormEditorSectionId,
} from '@/lib/leadFormEditorUtils'
import type {
  LeadCaptureStatus,
  LeadFormListItem,
  LeadFormRouting,
} from '@radarchat-types/lead-form'
import {
  DEFAULT_LEAD_FORM_ROUTING,
  LEAD_CAPTURE_STATUS_LABEL,
} from '@radarchat-types/lead-form'

export type { LeadFormEditorSectionId }

type Props = {
  form: LeadFormListItem
  contactGroups: { id: string; name: string }[]
  assignees: { userId: string; displayName: string }[]
  initialSection?: LeadFormEditorSectionId
  embedded?: boolean
  onSave: (patch: Partial<LeadFormListItem>) => void
  onDelete: () => void
  onDuplicate?: () => void
  pending: boolean
  deleting: boolean
  duplicating?: boolean
  organizationPlan?: string | null
  onSaved?: () => void
}

export function LeadFormEditorCard({
  form,
  contactGroups,
  assignees,
  initialSection,
  embedded = false,
  onSave,
  onDelete,
  onDuplicate,
  pending,
  deleting,
  duplicating,
  organizationPlan,
  onSaved,
}: Props) {
  const baseline = useMemo(
    () => ({
      ...form,
      includeCompanyWebsite: form.includeCompanyWebsite !== false,
    }),
    [form],
  )

  const [draft, setDraft] = useState<LeadFormListItem>(baseline)
  const [section, setSection] = useState<LeadFormEditorSectionId>(initialSection ?? 'overview')
  const [previewReloadKey, setPreviewReloadKey] = useState(0)
  const [previewSection, setPreviewSection] = useState(() => loadLeadFormPreviewSection(form.publicKey))

  const previewAppearance = useMemo(
    () => ({
      theme: draft.appearance.theme,
      size: draft.appearance.size,
      borderRadius: draft.appearance.borderRadius,
      showLogo: resolveProductBrandingVisible(organizationPlan, draft.appearance.showLogo),
      primaryColor: draft.appearance.primaryColor,
    }),
    [
      draft.appearance.theme,
      draft.appearance.size,
      draft.appearance.borderRadius,
      draft.appearance.showLogo,
      draft.appearance.primaryColor,
      organizationPlan,
    ],
  )

  const { data: orgProfile } = useQuery<{ website?: string }>({
    queryKey: ['organization-profile'],
    queryFn: () => api.get('/organization/profile'),
  })

  const routing: LeadFormRouting = { ...DEFAULT_LEAD_FORM_ROUTING, ...draft.routing }
  const isDirty = isLeadFormDirty(baseline, draft)
  const sectionStatuses = useMemo(
    () => getLeadFormSectionStatuses(draft, orgProfile?.website),
    [draft, orgProfile?.website],
  )

  useEffect(() => {
    setDraft({
      ...form,
      includeCompanyWebsite: form.includeCompanyWebsite !== false,
    })
    setSection(initialSection ?? 'overview')
    setPreviewSection(loadLeadFormPreviewSection(form.publicKey))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.id])

  useEffect(() => {
    if (initialSection) setSection(initialSection)
  }, [initialSection])

  const handleSave = () => {
    onSave({
      name: draft.name,
      active: draft.active,
      allowedDomains: draft.allowedDomains,
      includeCompanyWebsite: draft.includeCompanyWebsite !== false,
      redirectUrl: draft.redirectUrl,
      appearance: draft.appearance,
      routing: draft.routing,
    })
    setPreviewReloadKey(k => k + 1)
    onSaved?.()
  }

  const copyScript = () => {
    void navigator.clipboard.writeText(embedScriptSnippet(form.publicKey))
    notifySuccess('Script copiado')
  }

  const editorBody = (
    <>
      <LeadFormEditorHeader
        title={draft.appearance.title || form.name}
        internalName={draft.name}
        publicKey={form.publicKey}
        active={draft.active}
        onActiveChange={checked => setDraft(d => ({ ...d, active: checked }))}
        allowedDomains={draft.allowedDomains ?? []}
        includeCompanyWebsite={draft.includeCompanyWebsite !== false}
        companyWebsite={orgProfile?.website}
        isDirty={isDirty}
        saving={pending}
        duplicating={duplicating}
        deleting={deleting}
        previewReloadKey={previewReloadKey}
        previewSection={previewSection}
        previewAppearance={previewAppearance}
        onSave={handleSave}
        onDelete={onDelete}
        onDuplicate={onDuplicate}
        onCopyScript={copyScript}
      />

      <div className="p-4 pb-24 xl:pb-4">
        <div className="xl:grid xl:grid-cols-[minmax(0,1fr)_min(320px,32%)] xl:gap-5">
          <div className="order-2 min-w-0 xl:order-1">
            <div className="xl:grid xl:grid-cols-[220px_minmax(0,1fr)] xl:gap-4">
              <LeadFormSectionNav
                className="hidden xl:block"
                active={section}
                onChange={setSection}
                statuses={sectionStatuses}
              />

              <div className="min-w-0">
                <LeadFormSectionNavCompact active={section} onChange={setSection} />

                {section === 'overview' && (
                  <LeadFormEditorSection
                    id="lead-form-section-overview"
                    title="Visão geral"
                    description="Comece pelos domínios permitidos, depois identifique o formulário e integre no site."
                  >
                    <div className="space-y-4">
                      <LeadFormSectionCard
                        title="Publicação no site"
                        description="Enquanto inativo, o script no site não aceita envios — a prévia do painel continua funcionando."
                      >
                        <label className="flex items-start gap-3 rounded-lg border border-[var(--rz-border)] bg-[var(--rz-surface-muted)]/20 p-3">
                          <input
                            type="checkbox"
                            className="mt-0.5 h-4 w-4"
                            checked={draft.active}
                            onChange={e => setDraft(d => ({ ...d, active: e.target.checked }))}
                          />
                          <span className="text-sm text-[var(--rz-text)]">
                            <strong>Formulário ativo no site</strong>
                            <span className="mt-1 block text-xs text-[var(--rz-text-muted)]">
                              Ative e clique em Salvar no topo para publicar. Desative para pausar capturas sem
                              remover o script do site.
                            </span>
                          </span>
                        </label>
                      </LeadFormSectionCard>

                      <LeadFormSectionCard
                        title="Sites onde este formulário pode aparecer"
                        description="Primeiro passo — defina onde o embed pode carregar antes de copiar o script."
                      >
                        <EmbedSitesSection
                          title=""
                          description=""
                          includeCompanyWebsite={draft.includeCompanyWebsite !== false}
                          onIncludeCompanyWebsiteChange={checked =>
                            setDraft(d => ({ ...d, includeCompanyWebsite: checked }))
                          }
                          extraDomains={draft.allowedDomains ?? []}
                          onExtraDomainsChange={domains =>
                            setDraft(d => ({ ...d, allowedDomains: domains }))
                          }
                          companyWebsite={orgProfile?.website}
                          textareaCls={textareaCls}
                          id="lead-form-overview-domains"
                        />
                      </LeadFormSectionCard>

                      <LeadFormOverview statuses={sectionStatuses} onNavigate={setSection} />

                      <LeadFormSectionCard
                        title="Identificação"
                        description="Esse nome aparece apenas para sua equipe no painel."
                      >
                        <div className="grid gap-3 sm:grid-cols-2">
                          <label className="block text-xs font-medium text-[var(--rz-text-muted)] sm:col-span-2">
                            Nome interno do formulário
                            <input
                              className={inputCls + ' mt-1'}
                              value={draft.name}
                              onChange={e => setDraft(d => ({ ...d, name: e.target.value }))}
                              placeholder="Ex.: Site principal"
                            />
                          </label>
                        </div>
                      </LeadFormSectionCard>

                      <LeadFormSectionCard title="Textos do formulário" description="O visitante vê estes textos no embed.">
                        <input
                          className={inputCls}
                          placeholder="Título público"
                          value={draft.appearance.title}
                          onChange={e =>
                            setDraft(d => ({ ...d, appearance: { ...d.appearance, title: e.target.value } }))
                          }
                        />
                        <textarea
                          className={textareaCls}
                          rows={2}
                          placeholder="Descrição"
                          value={draft.appearance.description}
                          onChange={e =>
                            setDraft(d => ({
                              ...d,
                              appearance: { ...d.appearance, description: e.target.value },
                            }))
                          }
                        />
                        <div className="grid sm:grid-cols-2 gap-3">
                          <input
                            className={inputCls}
                            placeholder="Texto do botão"
                            value={draft.appearance.buttonText}
                            onChange={e =>
                              setDraft(d => ({
                                ...d,
                                appearance: { ...d.appearance, buttonText: e.target.value },
                              }))
                            }
                          />
                          <input
                            className={inputCls}
                            type="color"
                            title="Cor primária"
                            value={draft.appearance.primaryColor}
                            onChange={e =>
                              setDraft(d => ({
                                ...d,
                                appearance: { ...d.appearance, primaryColor: e.target.value },
                              }))
                            }
                          />
                        </div>
                        <textarea
                          className={textareaCls}
                          rows={2}
                          placeholder="Mensagem de sucesso"
                          value={draft.appearance.successMessage}
                          onChange={e =>
                            setDraft(d => ({
                              ...d,
                              appearance: { ...d.appearance, successMessage: e.target.value },
                            }))
                          }
                        />
                        <input
                          className={inputCls}
                          placeholder="URL após envio (opcional)"
                          value={draft.redirectUrl ?? ''}
                          onChange={e =>
                            setDraft(d => ({ ...d, redirectUrl: e.target.value || undefined }))
                          }
                        />
                      </LeadFormSectionCard>
                    </div>
                  </LeadFormEditorSection>
                )}

                {section === 'fields' && (
                  <LeadFormEditorSection
                    id="lead-form-section-fields"
                    title="Campos"
                    description="Defina quais informações o visitante deve preencher."
                  >
                    <LeadFormFieldsEditor
                      value={{
                        askEmail: draft.appearance.askEmail,
                        requireEmail: draft.appearance.requireEmail,
                        askMessage: draft.appearance.askMessage,
                        requireMessage: draft.appearance.requireMessage,
                        customFields: draft.appearance.customFields ?? [],
                      }}
                      onChange={fields =>
                        setDraft(d => ({
                          ...d,
                          appearance: { ...d.appearance, ...fields },
                        }))
                      }
                    />
                  </LeadFormEditorSection>
                )}

                {section === 'appearance' && (
                  <LeadFormEditorSection
                    id="lead-form-section-appearance"
                    title="Aparência"
                    description="Tema visual do formulário no site."
                  >
                    <div className="space-y-3">
                      <div>
                        <label className="text-xs text-[var(--rz-text-muted)]">Tema</label>
                        <select
                          className={inputCls + ' mt-1'}
                          value={draft.appearance.theme ?? 'auto'}
                          onChange={e =>
                            setDraft(d => ({
                              ...d,
                              appearance: {
                                ...d.appearance,
                                theme: e.target.value as 'auto' | 'light' | 'dark',
                              },
                            }))
                          }
                        >
                          <option value="auto">Automático (sistema)</option>
                          <option value="light">Claro</option>
                          <option value="dark">Escuro</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-xs text-[var(--rz-text-muted)]">Tamanho</label>
                        <select
                          className={inputCls + ' mt-1'}
                          value={draft.appearance.size ?? 'default'}
                          onChange={e =>
                            setDraft(d => ({
                              ...d,
                              appearance: {
                                ...d.appearance,
                                size: e.target.value as 'compact' | 'default' | 'wide',
                              },
                            }))
                          }
                        >
                          <option value="compact">Compacto</option>
                          <option value="default">Padrão</option>
                          <option value="wide">Largo</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-xs text-[var(--rz-text-muted)]">
                          Arredondamento ({draft.appearance.borderRadius ?? 8}px)
                        </label>
                        <input
                          type="range"
                          min={0}
                          max={24}
                          className="w-full mt-1"
                          value={draft.appearance.borderRadius ?? 8}
                          onChange={e =>
                            setDraft(d => ({
                              ...d,
                              appearance: {
                                ...d.appearance,
                                borderRadius: Number(e.target.value),
                              },
                            }))
                          }
                        />
                      </div>
                      <ProductBrandingFooterToggle
                        planId={organizationPlan}
                        checked={draft.appearance.showLogo ?? false}
                        onChange={checked =>
                          setDraft(d => ({
                            ...d,
                            appearance: { ...d.appearance, showLogo: checked },
                          }))
                        }
                      />
                    </div>
                  </LeadFormEditorSection>
                )}

                {section === 'dest' && (
                  <LeadFormEditorSection
                    id="lead-form-section-dest"
                    title="Destino do lead"
                    description="Para onde vão os leads capturados por este formulário."
                  >
                    <div className="space-y-3">
                      <div>
                        <label className="text-xs text-[var(--rz-text-muted)]">Status inicial do lead</label>
                        <select
                          className={inputCls + ' mt-1'}
                          value={routing.initialStatus}
                          onChange={e =>
                            setDraft(d => ({
                              ...d,
                              routing: {
                                ...routing,
                                initialStatus: e.target.value as LeadCaptureStatus,
                              },
                            }))
                          }
                        >
                          {(Object.keys(LEAD_CAPTURE_STATUS_LABEL) as LeadCaptureStatus[]).map(s => (
                            <option key={s} value={s}>
                              {LEAD_CAPTURE_STATUS_LABEL[s]}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="text-xs text-[var(--rz-text-muted)]">
                          Lista padrão para novos leads
                        </label>
                        <select
                          className={inputCls + ' mt-1'}
                          multiple
                          size={Math.min(5, contactGroups.length || 3)}
                          value={routing.defaultContactGroupIds}
                          onChange={e => {
                            const ids = Array.from(e.target.selectedOptions).map(o => o.value)
                            setDraft(d => ({ ...d, routing: { ...routing, defaultContactGroupIds: ids } }))
                          }}
                        >
                          {contactGroups.map(g => (
                            <option key={g.id} value={g.id}>
                              {g.name}
                            </option>
                          ))}
                        </select>
                        <p className="text-[10px] text-[var(--rz-text-muted)] mt-1">
                          Ctrl+clique para selecionar várias
                        </p>
                      </div>
                      <div>
                        <label className="text-xs text-[var(--rz-text-muted)]">
                          Tags padrão (separadas por vírgula)
                        </label>
                        <input
                          className={inputCls + ' mt-1'}
                          value={(routing.defaultTags ?? []).join(', ')}
                          onChange={e =>
                            setDraft(d => ({
                              ...d,
                              routing: {
                                ...routing,
                                defaultTags: e.target.value
                                  .split(',')
                                  .map(s => s.trim())
                                  .filter(Boolean),
                              },
                            }))
                          }
                        />
                      </div>
                      <div>
                        <label className="text-xs text-[var(--rz-text-muted)]">
                          Criar contato automaticamente
                        </label>
                        <select
                          className={inputCls + ' mt-1'}
                          value={routing.contactMode}
                          onChange={e =>
                            setDraft(d => ({
                              ...d,
                              routing: {
                                ...routing,
                                contactMode: e.target.value as LeadFormRouting['contactMode'],
                              },
                            }))
                          }
                        >
                          <option value="always">Sim — criar/vincular ao capturar</option>
                          <option value="qualify">Aguardar qualificação manual</option>
                          <option value="never">Apenas salvar como lead</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-xs text-[var(--rz-text-muted)]">Responsável padrão</label>
                        <select
                          className={inputCls + ' mt-1'}
                          value={routing.defaultAssigneeId ?? ''}
                          onChange={e =>
                            setDraft(d => ({
                              ...d,
                              routing: {
                                ...routing,
                                defaultAssigneeId: e.target.value || undefined,
                              },
                            }))
                          }
                        >
                          <option value="">Nenhum</option>
                          {assignees.map(a => (
                            <option key={a.userId} value={a.userId}>
                              {a.displayName}
                            </option>
                          ))}
                        </select>
                      </div>
                      <label
                        className="flex items-center gap-2 text-sm opacity-60"
                        title="Disponível em versão futura — use Iniciar atendimento manualmente"
                      >
                        <input
                          type="checkbox"
                          checked={routing.autoOpenInbox}
                          disabled
                          onChange={e =>
                            setDraft(d => ({
                              ...d,
                              routing: { ...routing, autoOpenInbox: e.target.checked },
                            }))
                          }
                        />
                        Enviar automaticamente para Inbox (em breve)
                      </label>
                    </div>
                  </LeadFormEditorSection>
                )}

                {section === 'security' && (
                  <LeadFormEditorSection
                    id="lead-form-section-security"
                    title="Segurança / LGPD"
                    description="Proteção contra spam e consentimento do visitante."
                  >
                    <div className="space-y-3">
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={draft.appearance.honeypot !== false}
                          onChange={e =>
                            setDraft(d => ({
                              ...d,
                              appearance: { ...d.appearance, honeypot: e.target.checked },
                            }))
                          }
                        />
                        Campo honeypot anti-spam
                      </label>
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={draft.appearance.requireConsent}
                          onChange={e =>
                            setDraft(d => ({
                              ...d,
                              appearance: { ...d.appearance, requireConsent: e.target.checked },
                            }))
                          }
                        />
                        Exigir aceite de consentimento (LGPD)
                      </label>
                      {draft.appearance.requireConsent && (
                        <>
                          <textarea
                            className={textareaCls}
                            rows={2}
                            placeholder="Texto do consentimento"
                            value={draft.appearance.consentText}
                            onChange={e =>
                              setDraft(d => ({
                                ...d,
                                appearance: { ...d.appearance, consentText: e.target.value },
                              }))
                            }
                          />
                          <input
                            className={inputCls}
                            placeholder="URL da política de privacidade"
                            value={draft.appearance.consentPolicyUrl ?? ''}
                            onChange={e =>
                              setDraft(d => ({
                                ...d,
                                appearance: {
                                  ...d.appearance,
                                  consentPolicyUrl: e.target.value || undefined,
                                },
                              }))
                            }
                          />
                        </>
                      )}
                    </div>
                  </LeadFormEditorSection>
                )}

                {section === 'instalacao' && (
                  <LeadFormEditorSection
                    id="lead-form-section-instalacao"
                    title="Integrar no site"
                    description="Copie o script e integre em WordPress, Elementor ou via API."
                  >
                    <LeadIntegrationsPanel forms={[draft]} hideDomains hideFormPicker hidePreview />
                  </LeadFormEditorSection>
                )}

                <WebChatWidgetSaveBar isDirty={isDirty} saving={pending} onSave={handleSave} />
              </div>
            </div>
          </div>

          <div className="order-1 mb-4 xl:order-2 xl:mb-0">
            <LeadFormPreviewPanel
              publicKey={form.publicKey}
              formName={draft.name}
              companyWebsite={orgProfile?.website}
              appearance={previewAppearance}
              section={previewSection}
              onSectionChange={value => {
                setPreviewSection(value)
                saveLeadFormPreviewSection(form.publicKey, value)
              }}
              reloadKey={previewReloadKey}
              active={draft.active}
            />
          </div>
        </div>
      </div>
    </>
  )

  if (embedded) {
    return <div className="min-w-0 border-t border-[var(--rz-border)]">{editorBody}</div>
  }

  return editorBody
}
