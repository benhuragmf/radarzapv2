import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '../lib/api'
import { Card } from '../components/ui/Card'
import { Badge } from '../components/ui/Badge'
import { Spinner } from '../components/ui/Spinner'
import { FileText, BookOpen } from 'lucide-react'
import { DiscordPage } from '../components/discord/DiscordPage'

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

  if (isLoading) {
    return (
      <div className="flex justify-center pt-20">
        <Spinner size={32} />
      </div>
    )
  }

  return (
    <DiscordPage
      description="Define como cada mensagem do Discord aparece no WhatsApp. As regras escolhem qual template usar."
      actions={
        <Link
          to="/discord/rules"
          className="text-xs text-brand-400 hover:underline flex items-center gap-1"
        >
          <BookOpen size={12} /> Ir para regras
        </Link>
      }
    >
      <Card className="border-gray-800 bg-gray-900/50 text-xs text-gray-500 space-y-1">
        <p>
          <strong className="text-gray-400">Variáveis comuns:</strong>{' '}
          <code className="text-brand-400">{'{titulo}'}</code>,{' '}
          <code className="text-brand-400">{'{conteudo}'}</code>,{' '}
          <code className="text-brand-400">{'{autor}'}</code>,{' '}
          <code className="text-brand-400">{'{canal}'}</code>,{' '}
          <code className="text-brand-400">{'{servidor}'}</code>
        </p>
      </Card>

      {templates.length === 0 && (
        <Card className="text-center py-12 text-gray-500">
          <FileText size={32} className="mx-auto mb-3 opacity-30" />
          <p className="font-medium text-gray-400">Nenhum formato cadastrado</p>
          <p className="text-sm mt-1">Execute o seed de templates ou crie via API.</p>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {templates.map(t => (
          <Card key={t._id}>
            <div className="flex items-center gap-2 mb-2">
              <span className="font-medium text-sm">{t.name}</span>
              {t.isDefault && <Badge label="padrão" variant="blue" />}
              <span className="ml-auto text-xs text-gray-600">{t.usageCount ?? 0} usos</span>
            </div>

            <pre className="text-xs text-gray-400 bg-gray-950 rounded-lg p-3 whitespace-pre-wrap break-words font-mono leading-relaxed border border-gray-800 max-h-48 overflow-y-auto">
              {t.content}
            </pre>

            {t.variables?.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1">
                {t.variables.map(v => (
                  <code key={v} className="text-[10px] px-1.5 py-0.5 rounded bg-gray-800 text-brand-400">
                    {`{${v}}`}
                  </code>
                ))}
              </div>
            )}
          </Card>
        ))}
      </div>
    </DiscordPage>
  )
}
