import Sessions from '../Sessions'
import { PlatformPage } from '../../components/platform/PlatformPage'
import { AccountStatsPanel } from '../../components/platform/AccountStatsPanel'

export default function WaStatus() {
  return (
    <PlatformPage
      title="Status das conexões"
      description="Resumo da conta, uso de mensagens e estado do WhatsApp em tempo real."
    >
      <AccountStatsPanel />
      <h3 className="text-sm font-medium text-gray-300 mb-3">Conexão WhatsApp</h3>
      <Sessions />
    </PlatformPage>
  )
}
