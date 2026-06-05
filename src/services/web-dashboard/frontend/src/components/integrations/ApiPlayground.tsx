import { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { api } from '../../lib/api'
import { Card } from '../ui/Card'
import { Button } from '../ui/Button'
import { Spinner } from '../ui/Spinner'
import { Zap } from 'lucide-react'
import { WhatsAppTextEditor } from '../whatsapp/WhatsAppTextEditor'

interface DestOption {
  _id: string
  name: string
  identifier: string
  type: string
}

export function ApiPlayground() {
  const [destination, setDestination] = useState('')
  const [message, setMessage] = useState('Teste via API RadarZap')
  const [result, setResult] = useState<string | null>(null)

  const { data: destinations = [] } = useQuery<DestOption[]>({
    queryKey: ['destinations'],
    queryFn: () => api.get('/destinations'),
  })

  const contacts = destinations.filter(d => d.type === 'contact')

  const send = useMutation({
    mutationFn: () =>
      api.post<{ ok?: boolean; destination?: string; error?: string }>('/integrations/playground', {
        destination,
        message,
      }),
    onSuccess: data => setResult(`Enviado para ${data.destination ?? destination}`),
    onError: (e: Error) => setResult(`Erro: ${e.message}`),
  })

  const inputCls =
    'w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200'

  return (
    <Card className="space-y-4 border-brand-800/30">
      <div className="flex items-center gap-2 text-brand-300 font-medium text-sm">
        <Zap size={16} />
        Playground API
      </div>
      <p className="text-xs text-gray-500">
        Testa o mesmo contrato de <code className="text-gray-400">POST /api/integrations/playground</code>.
      </p>
      <div>
        <label className="text-xs text-gray-500 block mb-1">Destino (E.164 ou ID cadastrado)</label>
        <select
          value={destination}
          onChange={e => setDestination(e.target.value)}
          className={inputCls}
        >
          <option value="">Selecione…</option>
          {contacts.map(d => (
            <option key={d._id} value={d.identifier}>
              {d.name} — {d.identifier}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="text-xs text-gray-500 block mb-1">Mensagem</label>
        <WhatsAppTextEditor
          value={message}
          onChange={setMessage}
          rows={3}
          placeholder="Mensagem de teste"
          showHint={false}
        />
      </div>
      <Button
        size="sm"
        onClick={() => send.mutate()}
        disabled={send.isPending || !destination || !message.trim()}
      >
        {send.isPending ? <Spinner size={14} /> : 'Enviar teste'}
      </Button>
      {result && <p className="text-xs text-gray-400">{result}</p>}
    </Card>
  )
}
