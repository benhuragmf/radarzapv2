import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { api } from '../../lib/api'
import { RadarPageShell, PageHeader, LoadingState } from '@/design-system'
import {
  WhatsAppSendLimitsEditor,
  type WhatsAppLimitsFormState,
} from '../../components/whatsapp/WhatsAppSendLimitsEditor'

interface SystemPolicyResponse {
  policy: {
    humanizeEnabled: boolean
    composingEnabled: boolean
    defaults: WhatsAppLimitsFormState['conversation'] extends infer _T
      ? Record<'conversation' | 'marketing' | 'alert', { enabled: boolean; maxPerMinute: number }>
      : never
    caps: Record<'conversation' | 'marketing' | 'alert', number>
    campaignDelays: NonNullable<WhatsAppLimitsFormState['campaignDelays']>
  }
}

export default function AdminSettingsPage() {
  const qc = useQueryClient()
  const { data, isLoading } = useQuery({
    queryKey: ['admin-whatsapp-send-policy'],
    queryFn: () => api.get<SystemPolicyResponse>('/admin/whatsapp-send-policy'),
  })

  const save = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      api.patch<SystemPolicyResponse>('/admin/whatsapp-send-policy', body),
    onSuccess: () => {
      toast.success('Política global de envio WA salva')
      qc.invalidateQueries({ queryKey: ['admin-whatsapp-send-policy'] })
      qc.invalidateQueries({ queryKey: ['campaigns-send-policy'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const initial: WhatsAppLimitsFormState | null = data
    ? {
        humanizeEnabled: data.policy.humanizeEnabled,
        composingEnabled: data.policy.composingEnabled,
        caps: data.policy.caps,
        conversation: data.policy.defaults.conversation,
        marketing: data.policy.defaults.marketing,
        alert: data.policy.defaults.alert,
        campaignDelays: {
          ...data.policy.campaignDelays,
          riskDelaysSec: [
            data.policy.campaignDelays.riskDelaysSec[0] ?? 3,
            data.policy.campaignDelays.riskDelaysSec[1] ?? 10,
            data.policy.campaignDelays.riskDelaysSec[2] ?? 20,
          ],
        },
      }
    : null

  const handleSave = (state: WhatsAppLimitsFormState) => {
    save.mutate({
      humanizeEnabled: state.humanizeEnabled,
      composingEnabled: state.composingEnabled,
      caps: state.caps,
      defaults: {
        conversation: state.conversation,
        marketing: state.marketing,
        alert: state.alert,
      },
      campaignDelays: state.campaignDelays,
    })
  }

  return (
    <RadarPageShell>
      <PageHeader
        title="Configurações gerais"
        subtitle="Limites globais de envio WhatsApp — fila humanizada anti-ban."
      />

      {isLoading || !initial ? (
        <LoadingState rows={6} className="pt-4" />
      ) : (
        <WhatsAppSendLimitsEditor
          mode="admin"
          initial={initial}
          saving={save.isPending}
          onSave={handleSave}
        />
      )}
    </RadarPageShell>
  )
}
