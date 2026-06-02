import { useQuery } from '@tanstack/react-query'
import { api } from '../lib/api'
import { Card } from '../components/ui/Card'
import { Badge } from '../components/ui/Badge'
import { Spinner } from '../components/ui/Spinner'
import { FileText } from 'lucide-react'

interface Template {
  _id: string
  name: string
  content: string
  isDefault: boolean
  usageCount: number
  variables: string[]
}

export default function Templates() {
  const { data: templates = [], isLoading } = useQuery<Template[]>({
    queryKey: ['templates'],
    queryFn: () => api.get('/templates'),
  })

  if (isLoading) return <div className="flex justify-center pt-20"><Spinner size={32} /></div>

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-400">{templates.length} template(s)</p>

      {templates.length === 0 && (
        <Card className="text-center py-12 text-gray-500">
          <FileText size={32} className="mx-auto mb-3 opacity-30" />
          <p>Nenhum template encontrado.</p>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {templates.map((t) => (
          <Card key={t._id}>
            <div className="flex items-center gap-2 mb-2">
              <span className="font-medium text-sm">{t.name}</span>
              {t.isDefault && <Badge label="padrão" variant="blue" />}
            </div>

            {/* Preview */}
            <pre className="text-xs text-gray-400 bg-gray-950 rounded-lg p-3 whitespace-pre-wrap break-words font-mono leading-relaxed border border-gray-800">
              {t.content}
            </pre>

            <div className="mt-3 flex items-center gap-3 text-xs text-gray-500">
              {t.variables?.length > 0 && (
                <span>Variáveis: {t.variables.map(v => (
                  <code key={v} className="text-brand-400 mx-0.5">{`{${v}}`}</code>
                ))}</span>
              )}
              <span className="ml-auto">Usado {t.usageCount ?? 0}x</span>
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}
