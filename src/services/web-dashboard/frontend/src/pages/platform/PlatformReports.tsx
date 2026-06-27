import { PlatformPage } from '../../components/platform/PlatformPage'
import { SectionCard } from '../../design-system'
import { ContactClassificationReportSection } from '../../components/contacts/ContactClassificationReportSection'
import Logs from '../Logs'
import Queue from '../Queue'

export default function PlatformReports() {
  return (
    <PlatformPage
      title="Relatórios"
      description="Dados detalhados da operação: classificação CRM, logs de envio, erros e fila."
    >
      <div className="space-y-6">
        <SectionCard
          title="Classificação de contatos"
          description="Visão agregada da base CRM: tipo, permissão LGPD, temperatura e elegibilidade para campanhas."
        >
          <ContactClassificationReportSection />
        </SectionCard>
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
