import { Link } from 'react-router-dom'
import { Card } from '../../components/ui/Card'
import { Database } from 'lucide-react'

export default function AdminBackupPage() {
  return (
    <div className="space-y-5 max-w-2xl">
      <h1 className="text-lg font-semibold text-white flex items-center gap-2">
        <Database size={20} className="text-brand-400" />
        Backup
      </h1>
      <p className="text-sm text-gray-500">
        Backup administrativo do sistema — distinto do backup de contatos por empresa.
      </p>
      <Card className="text-sm text-gray-400 space-y-2">
        <p>Rotinas de backup completo (MongoDB, filas, sessões) são operadas na infraestrutura.</p>
        <p>
          Clientes exportam contatos em Plataforma →{' '}
          <Link to="/settings/backup" className="text-brand-400 hover:underline">
            Empresa → Backup
          </Link>
          .
        </p>
        <p className="text-xs text-gray-500 pt-2">
          Em produção: agendar snapshots do banco e retenção conforme política RadarZap.
        </p>
      </Card>
    </div>
  )
}
