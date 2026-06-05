import { useState } from 'react'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { downloadFile } from '../../lib/api'
import { Database, Download } from 'lucide-react'

export default function BackupExport() {
  const [loading, setLoading] = useState<'csv' | null>(null)
  const [error, setError] = useState<string | null>(null)

  const exportCsv = async () => {
    setLoading('csv')
    setError(null)
    try {
      await downloadFile('/destinations/export-csv', 'contatos-radarzap.csv')
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="space-y-5 max-w-2xl">
      <h1 className="text-lg font-semibold text-white flex items-center gap-2">
        <Database size={20} className="text-brand-400" />
        Backup
      </h1>
      <p className="text-sm text-gray-500">
        Exporte seus contatos para arquivo local. Modelos e regras podem ser reexportados pelas
        telas correspondentes.
      </p>
      <Card className="space-y-3">
        <p className="text-sm text-gray-300">Contatos (CSV)</p>
        <Button size="sm" onClick={exportCsv} disabled={loading === 'csv'}>
          <Download size={14} />
          {loading === 'csv' ? 'Exportando…' : 'Baixar CSV'}
        </Button>
        {error && <p className="text-xs text-red-400">{error}</p>}
      </Card>
    </div>
  )
}
