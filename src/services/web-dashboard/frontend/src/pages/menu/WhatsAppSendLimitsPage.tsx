import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { api } from '../../lib/api'
import { RadarPageShell, PageHeader, LoadingState } from '@/design-system'
import {
  WhatsAppSendLimitsEditor,
  type WhatsAppLimitsFormState,
} from '../../components/whatsapp/WhatsAppSendLimitsEditor'

type PolicyResponse = WhatsAppLimitsFormState & {
  caps: Record<'conversation' | 'marketing' | 'alert', number>
  allowMembersDisableCampaignProtection?: boolean
}

export default function WhatsAppSendLimitsPage() {
  const qc = useQueryClient()
  const { data, isLoading } = useQuery({
    queryKey: ['platform-whatsapp-send-limits'],
    queryFn: () => api.get<PolicyResponse>('/platform/whatsapp-send-limits'),
  })

  const save = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      api.patch<PolicyResponse>('/platform/whatsapp-send-limits', body),
    onSuccess: () => {
      toast.success('Limites de envio salvos')
      qc.invalidateQueries({ queryKey: ['platform-whatsapp-send-limits'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const initial: WhatsAppLimitsFormState | null = data
    ? {
        humanizeEnabled: data.humanizeEnabled,
        composingEnabled: data.composingEnabled,
        limitsDisabled: data.limitsDisabled,
        allowMembersDisableCampaignProtection: data.allowMembersDisableCampaignProtection,
        caps: data.caps,
        conversation: data.conversation,
        marketing: data.marketing,
        alert: data.alert,
      }
    : null

  const handleSave = (state: WhatsAppLimitsFormState) => {
    save.mutate({
      limitsDisabled: state.limitsDisabled,
      allowMembersDisableCampaignProtection: state.allowMembersDisableCampaignProtection,
      humanizeEnabled: state.humanizeEnabled,
      composingEnabled: state.composingEnabled,
      conversation: state.conversation,
      marketing: state.marketing,
      alert: state.alert,
    })
  }

  return (
    <RadarPageShell>
      <PageHeader
        title="Limites de envio WhatsApp"
        subtitle="Fila humanizada — chat ao vivo, campanhas e alertas. Ajuste dentro do teto definido pelo admin."
      />

      {isLoading || !initial ? (
        <LoadingState rows={6} className="pt-4" />
      ) : (
        <WhatsAppSendLimitsEditor
          mode="tenant"
          initial={initial}
          saving={save.isPending}
          onSave={handleSave}
        />
      )}
    </RadarPageShell>
  )
}
