import { Link } from 'react-router-dom'
import { PlatformPage } from '../../components/platform/PlatformPage'
import { AccountStatsPanel } from '../../components/platform/AccountStatsPanel'
import { WhatsAppConnectionHistory } from '../../components/whatsapp/WhatsAppConnectionHistory'
import { Smartphone } from 'lucide-react'

export default function WaStatus() {
  return (
    <PlatformPage
      title="Status das conexões"
      description="Resumo da conta, uso de mensagens e histórico de conexão WhatsApp em tempo real."
    >
      <AccountStatsPanel />

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h3 className="text-sm font-medium text-gray-300">Histórico de conexão</h3>
        <Link
          to="/sessions"
          className="inline-flex items-center gap-2 text-xs text-brand-400 hover:text-brand-300 transition-colors"
        >
          <Smartphone size={14} />
          Gerenciar sessão e QR Code →
        </Link>
      </div>

      <WhatsAppConnectionHistory />
    </PlatformPage>
  )
}
