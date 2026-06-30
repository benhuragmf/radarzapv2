import { useRef, useState } from 'react'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { downloadFile, api } from '../../lib/api'
import { Download, Upload } from 'lucide-react'
import { RadarPageShell, PageHeader } from '@/design-system'

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
      await downloadFile('/destinations/export-csv', 'contatos-radarchat.csv')
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
      await downloadFile('/tenant-backup/export', `radarchat-backup-${Date.now()}.json`)
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
    <RadarPageShell>
      <PageHeader
        title="Backup"
        subtitle="Exporte contatos (CSV) ou backup completo da empresa (JSON): setores, regras, templates, Inbox e integrações (sem segredos de API)."
      />

      {msg && (
        <div className="text-sm px-3 py-2 rounded-lg bg-[var(--rz-primary)]/10 border border-[var(--rz-primary)]/30 text-[var(--rz-primary)]">
          {msg}
        </div>
      )}

      <Card className="space-y-3">
        <p className="text-sm text-[var(--rz-text-primary)]">Contatos (CSV)</p>
        <Button size="sm" onClick={exportCsv} disabled={loading === 'csv'}>
          <Download size={14} />
          {loading === 'csv' ? 'Exportando…' : 'Baixar CSV'}
        </Button>
      </Card>

      <Card className="space-y-3">
        <p className="text-sm text-[var(--rz-text-primary)]">Empresa completa (JSON)</p>
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
        <p className="text-xs text-[var(--rz-text-muted)]">
          Restaurar exige permissão de dono/admin billing. Chaves de API não são reimportadas.
          Backups criptografados (produção) são aceitos automaticamente no mesmo formato JSON.
        </p>
      </Card>

      {error && <p className="text-xs text-[var(--rz-danger-text)]">{error}</p>}
    </RadarPageShell>
  )
}
