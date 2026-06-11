import { useEffect, useState } from 'react'
import { FolderOpen, Pencil, Plus, X } from 'lucide-react'
import { Button } from '../ui/Button'
import { Spinner } from '../ui/Spinner'
import { inputCls } from '../../lib/destinationUi'
import { formatPhone, isValidContactPhoneInput } from '../../lib/destinationFormat'
import { detectCountryFromE164, hasContactPhoneNationalDigits } from '../../lib/phoneCountries'
import ContactPhoneInput from './ContactPhoneInput'
import CountryFlag from './CountryFlag'
import type { ContactGroupItem } from './ContactGroupsSidebar'

export interface ContactFormData {
  identifier: string
  name: string
  email: string
  organization: string
  notes: string
  contactGroupIds: string[]
}

interface Props {
  mode: 'create' | 'edit'
  contactName?: string
  contactPhone?: string
  initial: ContactFormData
  groups: ContactGroupItem[]
  onSave: (data: ContactFormData) => Promise<void>
  onClose: () => void
}

export default function ContactEditorModal({
  mode,
  contactName,
  contactPhone,
  initial,
  groups,
  onSave,
  onClose,
}: Props) {
  const [form, setForm] = useState<ContactFormData>(initial)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setForm(initial)
  }, [initial])

  const set = <K extends keyof ContactFormData>(key: K, value: ContactFormData[K]) => {
    setForm(f => ({ ...f, [key]: value }))
  }

  const toggleGroup = (id: string) => {
    setForm(f => {
      const setIds = new Set(f.contactGroupIds)
      if (setIds.has(id)) setIds.delete(id)
      else setIds.add(id)
      return { ...f, contactGroupIds: [...setIds] }
    })
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await onSave(form)
      onClose()
    } finally {
      setSaving(false)
    }
  }

  const title = mode === 'create' ? 'Novo contato' : 'Editar contato'
  const phoneValid = mode === 'edit' || isValidContactPhoneInput(form.identifier)
  const canSave =
    form.name.trim() &&
    (mode === 'edit' || (form.identifier.trim() && phoneValid)) &&
    !saving

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
      <div
        className="w-full max-w-lg rounded-xl border border-gray-700 bg-gray-900 shadow-xl max-h-[90vh] flex flex-col"
        role="dialog"
        aria-labelledby="contact-editor-title"
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800 shrink-0">
          <div className="flex items-center gap-2">
            {mode === 'create' ? (
              <Plus size={16} className="text-brand-400" />
            ) : (
              <Pencil size={16} className="text-yellow-400" />
            )}
            <div>
              <p id="contact-editor-title" className="text-sm font-medium text-white">
                {title}
              </p>
              {mode === 'edit' && contactPhone && (
                <p className="text-xs text-gray-500 font-mono">{formatPhone(contactPhone)}</p>
              )}
            </div>
          </div>
          <button type="button" onClick={onClose} className="text-gray-500 hover:text-white p-1">
            <X size={18} />
          </button>
        </div>

        <div className="p-4 space-y-4 overflow-y-auto flex-1">
          {mode === 'create' && (
            <p className="text-xs text-gray-500">
              Novos contatos entram como{' '}
              <strong className="text-yellow-500">Aguardando aceite</strong>. O pedido LGPD é enviado na
              primeira mensagem.
            </p>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {mode === 'create' ? (
              <div className="sm:col-span-2">
                <label className="text-xs text-gray-500 mb-1 block">Número WhatsApp *</label>
                <ContactPhoneInput
                  value={form.identifier}
                  onChange={v => set('identifier', v)}
                />
                {hasContactPhoneNationalDigits(form.identifier) && !phoneValid && (
                  <p className="text-xs text-red-400 mt-1">
                    Número incompleto ou inválido. Brasil: DDD + celular (ex: 11999999999).
                  </p>
                )}
              </div>
            ) : (
              <div className="sm:col-span-2">
                <label className="text-xs text-gray-500 mb-1 block">Número</label>
                <p className="text-sm text-gray-400 font-mono px-3 py-2 bg-gray-800/50 rounded-lg border border-gray-800 flex items-center gap-2">
                  {contactPhone && (
                    <CountryFlag iso={detectCountryFromE164(contactPhone).iso} size={18} />
                  )}
                  {contactPhone ? formatPhone(contactPhone) : form.identifier}
                </p>
              </div>
            )}
            <div className="sm:col-span-2">
              <label className="text-xs text-gray-500 mb-1 block">Nome exibido *</label>
              <input
                value={form.name}
                onChange={e => set('name', e.target.value)}
                placeholder="Ex: João, Suporte"
                className={inputCls}
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">E-mail</label>
              <input
                value={form.email}
                onChange={e => set('email', e.target.value)}
                placeholder="opcional"
                className={inputCls}
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Empresa</label>
              <input
                value={form.organization}
                onChange={e => set('organization', e.target.value)}
                placeholder="opcional"
                className={inputCls}
              />
            </div>
            <div className="sm:col-span-2">
              <label className="text-xs text-gray-500 mb-1 block">Observações</label>
              <textarea
                value={form.notes}
                onChange={e => set('notes', e.target.value)}
                rows={2}
                placeholder="opcional"
                className={`${inputCls} resize-none`}
              />
            </div>
          </div>

          <div>
            <label className="text-xs text-gray-500 mb-1 block">Grupos de contato</label>
            <p className="text-[11px] text-gray-600 mb-2">
              Sem grupo selecionado = contato fica só em <strong className="text-gray-500">Todos os contatos</strong>.
            </p>
            {groups.length === 0 ? (
              <p className="text-xs text-gray-500 py-3 text-center border border-dashed border-gray-800 rounded-lg">
                Crie um grupo na barra lateral para organizar contatos.
              </p>
            ) : (
              <div className="max-h-40 overflow-y-auto space-y-1 border border-gray-800 rounded-lg p-1.5">
                {groups.map(g => {
                  const checked = form.contactGroupIds.includes(g._id)
                  return (
                    <label
                      key={g._id}
                      className={`flex items-center gap-3 px-2.5 py-2 rounded-lg cursor-pointer transition-colors ${
                        checked ? 'bg-brand-600/10 border border-brand-600/30' : 'hover:bg-gray-800/80'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleGroup(g._id)}
                        className="rounded border-gray-600"
                      />
                      <FolderOpen size={14} className="text-brand-400 shrink-0" />
                      <span className="text-sm text-gray-200 flex-1 truncate">{g.name}</span>
                      <span className="text-[10px] text-gray-600">{g.memberCount}</span>
                    </label>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2 px-4 py-3 border-t border-gray-800 shrink-0">
          <Button variant="ghost" size="sm" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button size="sm" onClick={handleSave} disabled={!canSave}>
            {saving ? <Spinner size={12} /> : mode === 'create' ? 'Cadastrar' : 'Salvar'}
          </Button>
        </div>
      </div>
    </div>
  )
}
