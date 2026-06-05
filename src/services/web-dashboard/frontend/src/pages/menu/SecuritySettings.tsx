import { Link } from 'react-router-dom'
import { Card } from '../../components/ui/Card'
import { ApiKeysPanel } from '../../components/integrations/ApiKeysPanel'
import { Shield } from 'lucide-react'

export default function SecuritySettings() {
  return (
    <div className="space-y-6 max-w-2xl">
      <section>
        <h1 className="text-lg font-semibold text-white flex items-center gap-2 mb-2">
          <Shield size={20} className="text-brand-400" />
          Segurança
        </h1>
        <p className="text-sm text-gray-500 mb-4">
          Revogue chaves comprometidas e limite integrações externas.
        </p>
        <ApiKeysPanel />
      </section>
      <Card className="text-xs text-gray-500">
        Sessão do painel: cookie HttpOnly. Para integrações use apenas HTTPS e rotacionar chaves
        periodicamente.{' '}
        <Link to="/settings#api-webhooks" className="text-brand-400 hover:underline">
          Webhooks
        </Link>
      </Card>
    </div>
  )
}
