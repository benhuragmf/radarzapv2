import Sessions from '../Sessions'
import { PlatformPage } from '../../components/platform/PlatformPage'

export default function WaStatus() {
  return (
    <PlatformPage
      title="Status"
      description="Estado em tempo real das sessões WhatsApp vinculadas à sua empresa."
    >
      <Sessions />
    </PlatformPage>
  )
}
