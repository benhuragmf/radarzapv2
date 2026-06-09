import { useRef, useState } from 'react'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { downloadFile, api } from '../../lib/api'
import { Database, Download, Upload } from 'lucide-react'

export default function BackupExport() {
  const fileRef = useRef<HTMLInputElement>(null)
  const [loading, setLoading] = useState<'csv' | 'json' | 'import' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)

  const exportCsv = async () => {
    setLoading('csv')
    setError(null)
    setMsg(null)
    try {
      await downloadFile('/destinations/export-csv', 'contatos-radarzap.csv')
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(null)
    }
  }

  const exportJson = async () => {
    setLoading('json')
    setError(null)
    setMsg(null)
    try {
      await downloadFile('/tenant-backup/export', `radarzap-backup-${Date.now()}.json`)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(null)
    }
  }

  const importJson = async (file: File) => {
    setLoading('import')
    setError(null)
    setMsg(null)
    try {
      const text = await file.text()
      const backup = JSON.parse(text)
      const replace = window.confirm(
        'Substituir dados existentes (contatos, setores, regras) antes de importar?',
      )
      const res = await api.post<{ imported: Record<string, number> }>('/tenant-backup/import', {
        backup,
        replace,
      })
      const parts = Object.entries(res.imported ?? {})
        .map(([k, v]) => `${k}: ${v}`)
        .join(', ')
      setMsg(`Importação concluída${parts ? ` (${parts})` : ''}`)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(null)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  return (
    <div className="space-y-5 max-w-2xl">
      <h1 className="text-lg font-semibold text-white flex items-center gap-2">
        <Database size={20} className="text-brand-400" />
        Backup
      </h1>
      <p className="text-sm text-gray-500">
        Exporte contatos (CSV) ou backup completo da empresa (JSON): setores, regras, templates,
        Inbox e integrações (sem segredos de API).
      </p>

      {msg && (
        <div className="text-sm px-3 py-2 rounded-lg bg-brand-500/10 border border-brand-500/30 text-brand-300">
          {msg}
        </div>
      )}

      <Card className="space-y-3">
        <p className="text-sm text-gray-300">Contatos (CSV)</p>
        <Button size="sm" onClick={exportCsv} disabled={loading === 'csv'}>
          <Download size={14} />
          {loading === 'csv' ? 'Exportando…' : 'Baixar CSV'}
        </Button>
      </Card>

      <Card className="space-y-3">
        <p className="text-sm text-gray-300">Empresa completa (JSON)</p>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={exportJson} disabled={loading === 'json'}>
            <Download size={14} />
            {loading === 'json' ? 'Exportando…' : 'Baixar backup JSON'}
          </Button>
          <Button
            size="sm"
            variant="secondary"
            disabled={loading === 'import'}
            onClick={() => fileRef.current?.click()}
          >
            <Upload size={14} />
            {loading === 'import' ? 'Importando…' : 'Restaurar JSON'}
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={e => {
              const f = e.target.files?.[0]
              if (f) void importJson(f)
            }}
          />
        </div>
        <p className="text-xs text-gray-600">
          Restaurar exige permissão de dono/admin billing. Chaves de API não são reimportadas.
          Backups criptografados (produção) são aceitos automaticamente no mesmo formato JSON.
        </p>
      </Card>

      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  )
}
