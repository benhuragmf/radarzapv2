import { PlatformPage } from '../../components/platform/PlatformPage'
import { SectionCard } from '../../design-system'
import Logs from '../Logs'
import Queue from '../Queue'

export default function PlatformReports() {
  return (
    <PlatformPage
      title="Relatórios"
      description="Dados detalhados da operação da sua empresa: logs de envio, erros e fila."
    >
      <div className="space-y-6">
        <SectionCard title="Logs de envio">
          <Logs scope="tenant" />
        </SectionCard>
        <SectionCard title="Fila de mensagens">
          <Queue scope="tenant" />
        </SectionCard>
      </div>
    </PlatformPage>
  )
}
