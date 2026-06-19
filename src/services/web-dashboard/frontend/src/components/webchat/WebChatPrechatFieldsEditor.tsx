import { Plus, Trash2, ChevronUp, ChevronDown, LayoutList, ListOrdered } from 'lucide-react'
import { Button } from '../ui/Button'
import { inputCls, textareaCls } from '@/design-system'
import { cn } from '@/lib/utils'
import {
  FIELD_TEMPLATES,
  classicPrechatFormAppearance,
  normalizePrechatField,
  resolvePrechatFields,
  resolvePrechatMode,
  slugifyPrechatFieldId,
  syncLegacyAppearanceFlags,
  type WebChatPrechatField,
  type WebChatPrechatMode,
} from '@/lib/webchatPrechatFields'

type AppearanceWithFields = {
  prechatFields?: WebChatPrechatField[]
  prechatMode?: WebChatPrechatMode
  askName: boolean
  askPhone: boolean
  askContactReason: boolean
  askEmail: boolean
  contactReasonOptions: string[]
}

type Props = {
  appearance: AppearanceWithFields
  onChange: (appearance: AppearanceWithFields) => void
  /** Salva imediatamente mudanças de modo (widget lê só o que está no servidor). */
  onPersist?: (appearance: AppearanceWithFields) => void
}

function moveField(fields: WebChatPrechatField[], index: number, dir: -1 | 1): WebChatPrechatField[] {
  const next = [...fields]
  const target = index + dir
  if (target < 0 || target >= next.length) return fields
  const tmp = next[index]
  next[index] = next[target]
  next[target] = tmp
  return next
}

export function WebChatPrechatFieldsEditor({ appearance, onChange, onPersist }: Props) {
  const fields = resolvePrechatFields(appearance)
  const mode = resolvePrechatMode(appearance)

  const updateAppearance = (patch: Partial<AppearanceWithFields>, persist = false) => {
    const next = syncLegacyAppearanceFlags({ ...appearance, ...patch })
    onChange(next)
    if (persist && onPersist) onPersist(next)
  }

  const updateFields = (next: WebChatPrechatField[]) => {
    updateAppearance({ prechatFields: next.map(normalizePrechatField) })
  }

  const patchField = (index: number, patch: Partial<WebChatPrechatField>) => {
    const next = fields.map((f, i) => (i === index ? normalizePrechatField({ ...f, ...patch }) : f))
    updateFields(next)
  }

  const removeField = (index: number) => {
    updateFields(fields.filter((_, i) => i !== index))
  }

  const addCustomField = () => {
    const label = 'Novo campo'
    updateFields([
      ...fields,
      normalizePrechatField({
        id: slugifyPrechatFieldId(`campo_${fields.length + 1}`),
        label,
        type: 'text',
        enabled: true,
        required: false,
        placeholder: '',
      }),
    ])
  }

  const addFromTemplate = (tpl: (typeof FIELD_TEMPLATES)[number]) => {
    const id = slugifyPrechatFieldId(tpl.label)
    if (fields.some(f => f.id === id)) return
    updateFields([
      ...fields,
      normalizePrechatField({
        id,
        label: tpl.label,
        type: tpl.type,
        enabled: true,
        required: false,
        placeholder: tpl.placeholder,
        maxLength: tpl.maxLength,
        options: tpl.options,
      }),
    ])
  }

  return (
    <div className="space-y-3 sm:col-span-2">
      <div>
        <h4 className="text-sm font-semibold text-[var(--rz-text)]">Dados coletados antes do chat</h4>
        <p className="mt-1 text-xs text-[var(--rz-text-muted)]">
          Escolha como o visitante preenche: <strong>etapas</strong> (uma pergunta por vez) ou{' '}
          <strong>formulário</strong> (todos os campos na mesma tela, ex.: Nome + Telefone + Motivo).
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => updateAppearance({ prechatMode: 'steps' }, true)}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition-colors',
            mode === 'steps'
              ? 'border-brand-500/50 bg-brand-500/10 text-brand-300'
              : 'border-[var(--rz-border)] text-[var(--rz-text-muted)] hover:border-[var(--rz-border)]',
          )}
        >
          <ListOrdered className="h-3.5 w-3.5" />
          Uma pergunta por vez
        </button>
        <button
          type="button"
          onClick={() => updateAppearance({ prechatMode: 'form' }, true)}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition-colors',
            mode === 'form'
              ? 'border-brand-500/50 bg-brand-500/10 text-brand-300'
              : 'border-[var(--rz-border)] text-[var(--rz-text-muted)] hover:border-[var(--rz-border)]',
          )}
        >
          <LayoutList className="h-3.5 w-3.5" />
          Formulário completo
        </button>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => {
            const next = classicPrechatFormAppearance(appearance)
            onChange(next)
            onPersist?.(next)
          }}
        >
          Aplicar formulário clássico
        </Button>
      </div>
      <p className="text-[10px] text-[var(--rz-text-muted)]">
        Formulário clássico: Nome + Telefone + Motivo do contato (texto, máx. 150 caracteres). O modo e o
        formulário clássico são salvos automaticamente no widget (não alteram tema nem cores).
      </p>

      <div className="space-y-2">
        {fields.map((field, index) => (
          <div
            key={field.id}
            className={cn(
              'rounded-lg border p-3',
              field.enabled
                ? 'border-[var(--rz-border)] bg-[var(--rz-surface)]'
                : 'border-dashed border-[var(--rz-border)] bg-[var(--rz-surface-muted)]/40 opacity-80',
            )}
          >
            <div className="flex flex-wrap items-start gap-2">
              <label className="flex items-center gap-2 text-xs text-[var(--rz-text)] shrink-0 pt-1">
                <input
                  type="checkbox"
                  checked={field.enabled}
                  onChange={e => patchField(index, { enabled: e.target.checked })}
                />
                Ativo
              </label>
              <label className="flex items-center gap-2 text-xs text-[var(--rz-text)] shrink-0 pt-1">
                <input
                  type="checkbox"
                  checked={field.required}
                  disabled={!field.enabled}
                  onChange={e => patchField(index, { required: e.target.checked })}
                />
                Obrigatório
              </label>
              <div className="flex gap-1 ml-auto">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="px-2"
                  disabled={index === 0}
                  onClick={() => updateFields(moveField(fields, index, -1))}
                >
                  <ChevronUp className="h-3.5 w-3.5" />
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="px-2"
                  disabled={index === fields.length - 1}
                  onClick={() => updateFields(moveField(fields, index, 1))}
                >
                  <ChevronDown className="h-3.5 w-3.5" />
                </Button>
                {!field.preset && (
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="px-2 text-red-400"
                    onClick={() => removeField(index)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            </div>

            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              <label className="block text-xs font-medium text-[var(--rz-text-muted)]">
                Pergunta / rótulo
                <input
                  className={inputCls + ' mt-1'}
                  value={field.label}
                  onChange={e => patchField(index, { label: e.target.value })}
                />
              </label>
              <label className="block text-xs font-medium text-[var(--rz-text-muted)]">
                Tipo
                <select
                  className={inputCls + ' mt-1'}
                  value={field.type}
                  disabled={!!field.preset && field.preset !== 'contact_reason'}
                  onChange={e =>
                    patchField(index, {
                      type: e.target.value as WebChatPrechatField['type'],
                      options:
                        e.target.value === 'select'
                          ? field.options ?? ['Opção 1', 'Outro']
                          : undefined,
                      maxLength:
                        e.target.value === 'textarea' || e.target.value === 'text'
                          ? field.maxLength
                          : undefined,
                    })
                  }
                >
                  <option value="text">Texto</option>
                  <option value="textarea">Texto longo</option>
                  <option value="phone">Telefone / WhatsApp</option>
                  <option value="email">E-mail</option>
                  <option value="select">Opções (botões / lista)</option>
                </select>
              </label>
              {(field.type === 'text' || field.type === 'textarea') && (
                <label className="block text-xs font-medium text-[var(--rz-text-muted)]">
                  Máx. caracteres (opcional)
                  <input
                    type="number"
                    min={1}
                    max={500}
                    className={inputCls + ' mt-1'}
                    value={field.maxLength ?? ''}
                    placeholder="Sem limite"
                    onChange={e => {
                      const n = parseInt(e.target.value, 10)
                      patchField(index, { maxLength: Number.isFinite(n) && n > 0 ? n : undefined })
                    }}
                  />
                </label>
              )}
              {field.type !== 'select' && (
                <label className="block text-xs font-medium text-[var(--rz-text-muted)] sm:col-span-2">
                  Placeholder (opcional)
                  <input
                    className={inputCls + ' mt-1'}
                    value={field.placeholder ?? ''}
                    onChange={e => patchField(index, { placeholder: e.target.value })}
                  />
                </label>
              )}
              {field.type === 'select' && (
                <label className="block text-xs font-medium text-[var(--rz-text-muted)] sm:col-span-2">
                  Opções (uma por linha)
                  <textarea
                    className={textareaCls + ' mt-1 font-mono text-xs'}
                    rows={4}
                    value={(field.options ?? []).join('\n')}
                    onChange={e =>
                      patchField(index, {
                        options: e.target.value
                          .split('\n')
                          .map(s => s.trim())
                          .filter(Boolean),
                      })
                    }
                  />
                </label>
              )}
            </div>
            {field.preset && (
              <p className="mt-2 text-[10px] text-[var(--rz-text-muted)]">
                Campo sugerido — pode desativar, mudar tipo (ex.: motivo como texto 150) ou tornar opcional.
              </p>
            )}
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="secondary" size="sm" onClick={addCustomField}>
          <Plus className="h-3.5 w-3.5" />
          Campo personalizado
        </Button>
      </div>

      <div>
        <p className="text-[10px] font-medium uppercase tracking-wider text-[var(--rz-text-muted)] mb-2">
          Exemplos rápidos
        </p>
        <div className="flex flex-wrap gap-1.5">
          {FIELD_TEMPLATES.map(tpl => (
            <button
              key={tpl.label}
              type="button"
              className="rounded-full border border-[var(--rz-border)] bg-[var(--rz-surface-muted)]/50 px-2.5 py-1 text-[10px] text-[var(--rz-text-secondary)] hover:border-brand-500/40"
              onClick={() => addFromTemplate(tpl)}
            >
              + {tpl.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
