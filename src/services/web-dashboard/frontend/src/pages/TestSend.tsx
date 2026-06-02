import { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { api } from '../lib/api'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Spinner } from '../components/ui/Spinner'
import { Send, CheckCircle, XCircle } from 'lucide-react'

interface Destination { _id: string; name: string; identifier: string; type: string }

export default function TestSend() {
  const [destination, setDestination] = useState('')
  const [message, setMessage]         = useState('')
  const [result, setResult]           = useState<{ success: boolean; message: string } | null>(null)

  const { data: destinations = [] } = useQuery<Destination[]>({
    queryKey: ['destinations'],
    queryFn: () => api.get('/destinations'),
  })

  const send = useMutation({
    mutationFn: () => api.post('/test-send', { destination, message }),
    onSuccess: (data: any) => setResult({ success: true,  message: data?.message ?? 'Enviado com sucesso!' }),
    onError:   (err: any)  => setResult({ success: false, message: err.message ?? 'Erro ao enviar.' }),
  })

  return (
    <div className="max-w-lg space-y-4">
      <Card>
        <h2 className="text-sm font-medium text-gray-300 mb-4">Enviar mensagem de teste</h2>

        <div className="space-y-3">
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Destino</label>
            <select
              value={destination}
              onChange={e => setDestination(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-300 focus:outline-none focus:border-brand-500"
            >
              <option value="">Todos os destinos</option>
              {destinations.map(d => (
                <option key={d._id} value={d.identifier}>
                  {d.name} ({d.identifier})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs text-gray-500 mb-1 block">Mensagem</label>
            <textarea
              value={message}
              onChange={e => setMessage(e.target.value)}
              rows={4}
              placeholder="Digite a mensagem de teste..."
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-300 focus:outline-none focus:border-brand-500 resize-none"
            />
          </div>

          <Button
            onClick={() => { setResult(null); send.mutate() }}
            disabled={!message.trim() || send.isPending}
            className="w-full justify-center"
          >
            {send.isPending ? <Spinner size={14} /> : <Send size={14} />}
            {send.isPending ? 'Enviando...' : 'Enviar'}
          </Button>
        </div>
      </Card>

      {result && (
        <Card className={`flex items-center gap-3 ${result.success ? 'border-green-800' : 'border-red-800'}`}>
          {result.success
            ? <CheckCircle size={18} className="text-green-400 shrink-0" />
            : <XCircle    size={18} className="text-red-400 shrink-0" />
          }
          <p className="text-sm">{result.message}</p>
        </Card>
      )}
    </div>
  )
}
