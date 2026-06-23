import { GripVertical, Plus, Trash2 } from 'lucide-react'
import { Button } from '../ui/Button'
import { inputCls, textareaCls } from '@/design-system'
import type { LeadFormCustomField } from '@radarzap-types/lead-form'

function newCustomFieldId(): string {
  const hex = crypto.randomUUID().replace(/-/g, '').slice(0, 12)
  return `cf_${hex}`
}

export type LeadFormFieldsDraft = {
  askEmail: boolean
  requireEmail: boolean
  askMessage: boolean
  requireMessage: boolean
  customFields: LeadFormCustomField[]
}

export function LeadFormFieldsEditor({
  value,
  onChange,
}: {
  value: LeadFormFieldsDraft
  onChange: (next: LeadFormFieldsDraft) => void
}) {
  const addField = () => {
    if ((value.customFields?.length ?? 0) >= 12) return
    onChange({
      ...value,
      customFields: [
        ...(value.customFields ?? []),
        {
          id: newCustomFieldId(),
          label: 'Novo campo',
          type: 'text',
          required: false,
        },
      ],
    })
  }

  const updateCustom = (index: number, patch: Partial<LeadFormCustomField>) => {
    const list = [...(value.customFields ?? [])]
    list[index] = { ...list[index], ...patch }
    onChange({ ...value, customFields: list })
  }

  const removeCustom = (index: number) => {
    onChange({
      ...value,
      customFields: (value.customFields ?? []).filter((_, i) => i !== index),
    })
  }

  return (
    <div className="space-y-4 rounded-lg border border-[var(--rz-border)] p-4">
      <div>
        <h4 className="text-sm font-semibold">Campos do formulário</h4>
        <p className="text-xs text-[var(--rz-text-muted)] mt-1">
          Nome e telefone são sempre obrigatórios. Ative ou remova e-mail e mensagem; adicione campos extras.
        </p>
      </div>

      <div className="space-y-2 text-sm">
        <div className="flex items-center justify-between rounded-lg bg-[var(--rz-surface-muted)] px-3 py-2 opacity-80">
          <span>Nome</span>
          <span className="text-xs text-[var(--rz-text-muted)]">Fixo · obrigatório</span>
        </div>
        <div className="flex items-center justify-between rounded-lg bg-[var(--rz-surface-muted)] px-3 py-2 opacity-80">
          <span>WhatsApp / Telefone</span>
          <span className="text-xs text-[var(--rz-text-muted)]">Fixo · obrigatório</span>
        </div>

        <div className="rounded-lg border border-[var(--rz-border)] px-3 py-2 space-y-2">
          <label className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={value.askEmail}
                onChange={e =>
                  onChange({
                    ...value,
                    askEmail: e.target.checked,
                    requireEmail: e.target.checked ? value.requireEmail : false,
                  })
                }
              />
              E-mail
            </span>
            {value.askEmail && (
              <label className="flex items-center gap-1.5 text-xs text-[var(--rz-text-muted)]">
                <input
                  type="checkbox"
                  checked={value.requireEmail}
                  onChange={e => onChange({ ...value, requireEmail: e.target.checked })}
                />
                Obrigatório
              </label>
            )}
          </label>
        </div>

        <div className="rounded-lg border border-[var(--rz-border)] px-3 py-2 space-y-2">
          <label className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={value.askMessage}
                onChange={e =>
                  onChange({
                    ...value,
                    askMessage: e.target.checked,
                    requireMessage: e.target.checked ? value.requireMessage : false,
                  })
                }
              />
              Mensagem
            </span>
            {value.askMessage && (
              <label className="flex items-center gap-1.5 text-xs text-[var(--rz-text-muted)]">
                <input
                  type="checkbox"
                  checked={value.requireMessage}
                  onChange={e => onChange({ ...value, requireMessage: e.target.checked })}
                />
                Obrigatório
              </label>
            )}
          </label>
        </div>
      </div>

      {(value.customFields?.length ?? 0) > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-[var(--rz-text-secondary)]">Campos extras</p>
          {value.customFields.map((cf, index) => (
            <div
              key={cf.id}
              className="grid sm:grid-cols-[auto_1fr_auto_auto] gap-2 items-start rounded-lg border border-[var(--rz-border)] p-2"
            >
              <GripVertical size={16} className="text-[var(--rz-text-muted)] mt-2.5 hidden sm:block" />
              <div className="space-y-2 sm:col-span-1">
                <input
                  className={inputCls + ' text-sm'}
                  placeholder="Rótulo do campo"
                  value={cf.label}
                  onChange={e => updateCustom(index, { label: e.target.value })}
                />
                <input
                  className={inputCls + ' text-sm'}
                  placeholder="Placeholder (opcional)"
                  value={cf.placeholder ?? ''}
                  onChange={e => updateCustom(index, { placeholder: e.target.value || undefined })}
                />
              </div>
              <select
                className={inputCls + ' text-sm'}
                value={cf.type}
                onChange={e => updateCustom(index, { type: e.target.value as LeadFormCustomField['type'] })}
              >
                <option value="text">Texto curto</option>
                <option value="textarea">Texto longo</option>
                <option value="email">E-mail</option>
                <option value="tel">Telefone</option>
                <option value="select">Seleção</option>
                <option value="checkbox">Checkbox</option>
                <option value="hidden">Oculto</option>
              </select>
              {cf.type === 'select' && (
                <input
                  className={inputCls + ' text-sm sm:col-span-2'}
                  placeholder="Opções separadas por vírgula"
                  value={(cf.options ?? []).join(', ')}
                  onChange={e =>
                    updateCustom(index, {
                      options: e.target.value
                        .split(',')
                        .map(s => s.trim())
                        .filter(Boolean),
                    })
                  }
                />
              )}
              <div className="flex flex-col gap-2 items-end">
                <label className="flex items-center gap-1 text-xs whitespace-nowrap">
                  <input
                    type="checkbox"
                    checked={cf.required}
                    onChange={e => updateCustom(index, { required: e.target.checked })}
                  />
                  Obrig.
                </label>
                <button
                  type="button"
                  className="p-1.5 rounded text-red-600 hover:bg-red-500/10"
                  title="Remover campo"
                  onClick={() => removeCustom(index)}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Button type="button" variant="secondary" size="sm" onClick={addField}>
        <Plus size={14} /> Adicionar campo
      </Button>
    </div>
  )
}
