import { PlatformPage } from '../../components/platform/PlatformPage'
import Logs from '../Logs'
import Queue from '../Queue'

export default function PlatformReports() {
  return (
    <PlatformPage
      title="Relatórios"
      description="Dados detalhados da operação da sua empresa: logs de envio, erros e fila."
    >
      <div className="space-y-8">
        <section>
          <h2 className="text-sm font-medium text-gray-300 mb-3">Logs de envio</h2>
          <Logs scope="tenant" />
        </section>
        <section>
          <h2 className="text-sm font-medium text-gray-300 mb-3">Fila de mensagens</h2>
          <Queue scope="tenant" />
        </section>
      </div>
    </PlatformPage>
  )
}
