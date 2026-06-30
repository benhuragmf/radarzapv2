import type { InboundRegistrationPolicy } from '@radarchat-types/inbound-registration-policy'
import { Card } from '../ui/Card'
import { inputCls } from '@/design-system'

type ChannelMode = InboundRegistrationPolicy['whatsapp']
type FormMode = InboundRegistrationPolicy['form']
type ReturnMode = InboundRegistrationPolicy['returnCustomer']

const CHANNEL_OPTIONS: Array<{ value: ChannelMode; label: string; hint: string }> = [
  { value: 'contact', label: 'Contato', hint: 'Cadastra em Contatos (aprovado). Sem lead automático.' },
  { value: 'lead', label: 'Lead', hint: 'Central de Leads. Contato técnico oculto para o Inbox.' },
  { value: 'both', label: 'Ambos', hint: 'Contato + lead quando houver intenção comercial (padrão WA).' },
  { value: 'pending', label: 'Pendente', hint: 'Aguarda aprovação do dono antes de listar em Contatos.' },
  {
    value: 'conversation_only',
    label: 'Apenas conversa',
    hint: 'Só Inbox / chat. Não entra em Contatos nem Leads automaticamente.',
  },
]

const FORM_OPTIONS: Array<{ value: FormMode; label: string; hint: string }> = [
  { value: 'lead', label: 'Lead', hint: 'Só Central de Leads.' },
  { value: 'contact', label: 'Contato', hint: 'Só Contatos (sem lead).' },
  { value: 'both', label: 'Ambos', hint: 'Lead + contato aprovado (padrão).' },
  { value: 'pending', label: 'Pendente', hint: 'Lead + contato aguardando aprovação.' },
]

const RETURN_OPTIONS: Array<{ value: ReturnMode; label: string; hint: string }> = [
  { value: 'return_lead', label: 'Lead de retorno', hint: 'Nova conversa gera entrada na Central de Leads.' },
  { value: 'existing_contact', label: 'Contato existente', hint: 'Reutiliza CRM; sem lead automático de retorno.' },
  {
    value: 'conversation_only',
    label: 'Apenas conversa',
    hint: 'Só retoma atendimento; sem novo lead.',
  },
]

function SelectRow<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: T
  options: Array<{ value: T; label: string; hint: string }>
  onChange: (v: T) => void
}) {
  return (
    <label className="block space-y-1">
      <span className="text-sm font-medium text-[var(--rz-text-primary)]">{label}</span>
      <select className={inputCls} value={value} onChange={e => onChange(e.target.value as T)}>
        {options.map(o => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <p className="text-xs text-[var(--rz-text-muted)]">
        {options.find(o => o.value === value)?.hint}
      </p>
    </label>
  )
}

interface Props {
  policy: InboundRegistrationPolicy
  onChange: (policy: InboundRegistrationPolicy) => void
}

export function InboundRegistrationPolicyPanel({ policy, onChange }: Props) {
  const patch = <K extends keyof InboundRegistrationPolicy>(key: K, value: InboundRegistrationPolicy[K]) => {
    onChange({ ...policy, [key]: value })
  }

  return (
    <div className="space-y-4">
      <Card className="space-y-4 p-5">
        <div>
          <h2 className="text-sm font-semibold text-[var(--rz-text-primary)]">Canais de entrada</h2>
          <p className="text-xs text-[var(--rz-text-muted)] mt-1">
            Define onde cada primeiro contato é cadastrado. Atendimento manual pelo painel sempre cria contato
            aprovado.
          </p>
        </div>
        <SelectRow
          label="WhatsApp"
          value={policy.whatsapp}
          options={CHANNEL_OPTIONS}
          onChange={v => patch('whatsapp', v)}
        />
        <SelectRow
          label="Chat do site"
          value={policy.webchat}
          options={CHANNEL_OPTIONS}
          onChange={v => patch('webchat', v)}
        />
        <SelectRow
          label="Formulário público"
          value={policy.form}
          options={FORM_OPTIONS}
          onChange={v => patch('form', v)}
        />
      </Card>

      <Card className="space-y-4 p-5">
        <div>
          <h2 className="text-sm font-semibold text-[var(--rz-text-primary)]">Retorno de cliente</h2>
          <p className="text-xs text-[var(--rz-text-muted)] mt-1">
            Quando alguém que já existe no CRM inicia uma nova conversa ou sessão no chat.
          </p>
        </div>
        <SelectRow
          label="Política de retorno"
          value={policy.returnCustomer}
          options={RETURN_OPTIONS}
          onChange={v => patch('returnCustomer', v)}
        />
      </Card>

      <Card className="p-4 border-dashed">
        <p className="text-xs text-[var(--rz-text-muted)]">
          Contatos <strong className="font-medium text-[var(--rz-text-secondary)]">pendentes</strong> não aparecem
          na lista principal até aprovação em Contatos. Use o filtro de cadastro ou edite o contato para aprovar.
        </p>
      </Card>
    </div>
  )
}
