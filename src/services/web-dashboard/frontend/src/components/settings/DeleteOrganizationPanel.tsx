import { useState } from 'react'
import { AlertTriangle, ChevronDown, Trash2 } from 'lucide-react'
import type { AuthUser } from '../../lib/auth'
import { logout } from '../../lib/auth'
import { Button } from '../ui/Button'
import { Spinner } from '../ui/Spinner'

const CONFIRM_PHRASE = 'APAGAR TUDO'

const DELETED_ITEMS = [
  'Empresa, equipe e permissões de todos os membros nesta organização',
  'Sessão WhatsApp, credenciais e pasta de conexão no servidor',
  'Contatos, grupos, consentimentos LGPD e histórico de envios',
  'Fila de mensagens, campanhas, templates e status WhatsApp',
  'Inbox completo (conversas, mensagens, setores e configurações do bot)',
  'Canais e regras Discord vinculados a esta empresa',
  'Chaves de API, webhooks e automações',
  'Logs e registros operacionais deste tenant',
]

interface Props {
  user: AuthUser
}

export default function DeleteOrganizationPanel({ user }: Props) {
  const [expanded, setExpanded] = useState(false)
  const [understood, setUnderstood] = useState(false)
  const [confirmText, setConfirmText] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleCollapse = () => {
    setExpanded(false)
    setUnderstood(false)
    setConfirmText('')
    setError(null)
  }

  const orgName = user.organizationName ?? 'sua empresa'
  const canSubmit = understood && confirmText.trim() === CONFIRM_PHRASE && !loading

  const handleDelete = async () => {
    if (!canSubmit) return
    const ok = window.confirm(
      `Última confirmação: excluir permanentemente "${orgName}" e TODOS os dados listados? Esta ação não pode ser desfeita.`,
    )
    if (!ok) return

    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/auth/account/delete-organization', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmation: CONFIRM_PHRASE }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error((data as { error?: string }).error ?? 'Falha ao excluir conta')
      }
      try {
        await logout()
      } catch {
        window.location.href = '/'
      }
    } catch (e) {
      setError((e as Error).message)
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className="w-10 h-10 rounded-lg bg-red-950/80 border border-red-900/60 flex items-center justify-center shrink-0">
            <AlertTriangle size={20} className="text-red-400" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-red-300">Zona de perigo</h3>
            <p className="text-xs text-gray-500 mt-1 leading-relaxed">
              Excluir permanentemente <strong className="text-gray-400">{orgName}</strong> e todos os dados.
              Ação irreversível — apenas o dono.
            </p>
          </div>
        </div>
        {!expanded && (
          <Button
            type="button"
            variant="secondary"
            onClick={() => setExpanded(true)}
            className="shrink-0 !border-red-900/50 !text-red-300 hover:!bg-red-950/40"
          >
            <Trash2 size={14} />
            Excluir empresa
          </Button>
        )}
      </div>

      {expanded && (
        <>
      <p className="text-xs text-gray-400 leading-relaxed -mt-1">
        Remove permanentemente a empresa <strong className="text-gray-300">{orgName}</strong> e{' '}
        <strong className="text-red-300/90">todos os dados</strong> associados. Não há backup automático
        nem recuperação após confirmar.
      </p>

      <div className="rounded-xl border border-red-900/50 bg-red-950/20 p-4">
        <p className="text-xs font-medium text-red-200/90 mb-2">Será apagado sem exceção:</p>
        <ul className="text-xs text-gray-400 space-y-1.5 list-disc list-inside leading-relaxed">
          {DELETED_ITEMS.map(item => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>

      <label className="flex items-start gap-3 cursor-pointer group">
        <input
          type="checkbox"
          checked={understood}
          onChange={e => setUnderstood(e.target.checked)}
          className="mt-0.5 rounded border-gray-600 bg-gray-800 text-red-500 focus:ring-red-600/40"
        />
        <span className="text-xs text-gray-400 group-hover:text-gray-300 leading-relaxed">
          Entendo que esta ação é <strong className="text-red-300">irreversível</strong> e que todos os dados
          da empresa serão perdidos para sempre, incluindo mensagens, contatos e integrações.
        </span>
      </label>

      <div>
        <label className="text-xs text-gray-500 mb-1.5 block">
          Digite <code className="text-red-300 font-mono">{CONFIRM_PHRASE}</code> para confirmar
        </label>
        <input
          type="text"
          value={confirmText}
          onChange={e => setConfirmText(e.target.value)}
          placeholder={CONFIRM_PHRASE}
          autoComplete="off"
          spellCheck={false}
          className="w-full bg-gray-950 border border-red-900/40 rounded-lg px-3 py-2 text-sm text-gray-200 font-mono focus:outline-none focus:border-red-600/60"
        />
      </div>

      {error && (
        <div className="px-4 py-2 rounded-lg text-sm border bg-red-900/30 border-red-800 text-red-400">
          {error}
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-2">
        <Button
          type="button"
          disabled={!canSubmit}
          onClick={handleDelete}
          className="!bg-red-700 hover:!bg-red-600 !border-red-600 w-full sm:w-auto"
        >
          {loading ? <Spinner size={14} /> : <Trash2 size={14} />}
          Excluir empresa e todos os dados
        </Button>
        <Button
          type="button"
          variant="secondary"
          disabled={loading}
          onClick={handleCollapse}
          className="w-full sm:w-auto"
        >
          <ChevronDown size={14} />
          Cancelar
        </Button>
      </div>
        </>
      )}
    </div>
  )
}
