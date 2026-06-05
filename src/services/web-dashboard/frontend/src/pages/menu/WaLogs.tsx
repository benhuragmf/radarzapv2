import { PlatformPage } from '../../components/platform/PlatformPage'
import Logs from '../Logs'

export default function WaLogs() {
  return (
    <PlatformPage
      title="Logs"
      description="Eventos de envio e sessão WhatsApp do seu tenant."
    >
      <Logs scope="tenant" serviceFilter="WhatsAppService" />
    </PlatformPage>
  )
}
