import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { PlatformPage } from '../../components/platform/PlatformPage'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Spinner } from '../../components/ui/Spinner'
import { api } from '../../lib/api'
import { ListOrdered, Users } from 'lucide-react'

interface GroupRow {
  _id: string
  name: string
  memberCount: number
  color?: string
}

export default function ContactSegments() {
  const { data: groups = [], isLoading } = useQuery<GroupRow[]>({
    queryKey: ['contact-groups'],
    queryFn: () => api.get('/contact-groups'),
  })

  return (
    <PlatformPage
      title="Segmentos / Listas"
      description="Grupos de contato para segmentar envios, automações e filtros no painel."
    >
      <Link to="/contact">
        <Button size="sm" variant="secondary" className="mb-4">
          <Users size={14} /> Gerenciar em Contatos
        </Button>
      </Link>

      {isLoading ? (
        <div className="flex justify-center py-12"><Spinner size={28} /></div>
      ) : groups.length === 0 ? (
        <Card className="text-center py-12 text-gray-500">
          <ListOrdered size={32} className="mx-auto mb-2 opacity-40" />
          <p>Nenhum segmento criado.</p>
          <Link to="/contact" className="text-brand-400 text-sm hover:underline mt-2 inline-block">
            Criar grupo de contato
          </Link>
        </Card>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          {groups.map(g => (
            <Card key={g._id}>
              <p className="text-sm font-medium text-white">{g.name}</p>
              <p className="text-xs text-gray-500 mt-1">{g.memberCount} contato(s)</p>
            </Card>
          ))}
        </div>
      )}
    </PlatformPage>
  )
}
