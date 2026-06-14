import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../lib/api'
import { Button } from '../ui/Button'
import { Spinner } from '../ui/Spinner'
import { Building2, Save } from 'lucide-react'
import { can, type AuthUser } from '../../lib/auth'
import { notifyError, notifySuccess, notifyInfo, mutationError } from '../../lib/notify'

interface OrgProfile {
  name: string
  phone: string
  email: string
  website: string
  taxId: string
  address: string
  plan: string
}

const inputCls =
  'w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-brand-500'

export function CompanyProfilePanel({ user }: { user: AuthUser }) {
  const qc = useQueryClient()
  const canEdit = can(user, 'billing:manage')

  const { data, isLoading } = useQuery<OrgProfile>({
    queryKey: ['organization-profile'],
    queryFn: () => api.get('/organization/profile'),
  })

  const [form, setForm] = useState({
    name: '',
    phone: '',
    email: '',
    website: '',
    taxId: '',
    address: '',
  })

  useEffect(() => {
    if (data) {
      setForm({
        name: data.name,
        phone: data.phone,
        email: data.email,
        website: data.website,
        taxId: data.taxId,
        address: data.address,
      })
    }
  }, [data])

  const save = useMutation({
    mutationFn: () => api.patch('/organization/profile', form),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['organization-profile'] })
      qc.invalidateQueries({ queryKey: ['billing-me'] })
      qc.invalidateQueries({ queryKey: ['platform-account-stats'] })
      notifySuccess('Dados da empresa salvos.')
    },
    onError: mutationError,
  })

  if (isLoading) {
    return (
      <div className="flex justify-center py-6">
        <Spinner size={20} />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm text-gray-400">
        <Building2 size={16} className="text-brand-400" />
        Plano atual: <span className="text-gray-200 capitalize">{data?.plan ?? user.plan}</span>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="text-xs text-gray-500 block mb-1">Nome da empresa *</label>
          <input
            value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            disabled={!canEdit}
            className={inputCls}
            placeholder="Radar Gamer Ltda"
          />
        </div>
        <div>
          <label className="text-xs text-gray-500 block mb-1">Telefone / WhatsApp comercial</label>
          <input
            value={form.phone}
            onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
            disabled={!canEdit}
            className={inputCls}
            placeholder="+55 11 99999-0000"
          />
        </div>
        <div>
          <label className="text-xs text-gray-500 block mb-1">E-mail</label>
          <input
            type="email"
            value={form.email}
            onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
            disabled={!canEdit}
            className={inputCls}
            placeholder="contato@empresa.com"
          />
        </div>
        <div>
          <label className="text-xs text-gray-500 block mb-1">CNPJ / CPF</label>
          <input
            value={form.taxId}
            onChange={e => setForm(f => ({ ...f, taxId: e.target.value }))}
            disabled={!canEdit}
            className={inputCls}
            placeholder="00.000.000/0001-00"
          />
        </div>
        <div>
          <label className="text-xs text-gray-500 block mb-1">Site</label>
          <input
            value={form.website}
            onChange={e => setForm(f => ({ ...f, website: e.target.value }))}
            disabled={!canEdit}
            className={inputCls}
            placeholder="https://..."
          />
        </div>
        <div className="sm:col-span-2">
          <label className="text-xs text-gray-500 block mb-1">Endereço</label>
          <input
            value={form.address}
            onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
            disabled={!canEdit}
            className={inputCls}
            placeholder="Rua, cidade, estado"
          />
        </div>
      </div>

      {!canEdit && (
        <p className="text-xs text-gray-600">
          Apenas proprietários ou administradores podem editar os dados da empresa.
        </p>
      )}

      {canEdit && (
        <Button size="sm" onClick={() => save.mutate()} disabled={save.isPending || !form.name.trim()}>
          {save.isPending ? <Spinner size={14} /> : <Save size={14} />}
          Salvar empresa
        </Button>
      )}
    </div>
  )
}
