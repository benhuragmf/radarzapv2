import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { CheckCircle2, FlaskConical, Rocket } from 'lucide-react'
import { RadarPageShell, PageHeader, SectionCard, inputCls, selectCls, textareaCls } from '@/design-system'
import { toastSuccess, toastError } from '@/design-system/toast'
import { api } from '../lib/api'
import { Badge } from '../components/ui/Badge'
import {
  ALPHA_PHASE_CURRENT_MODULES,
  ALPHA_PHASE_ROADMAP,
  roadmapStatusLabel,
} from '../lib/alphaPhaseProjectInfo'

const initialForm = {
  title: '',
  summary: '',
  expectedBehavior: '',
  stepsToReproduce: '',
  affectedArea: '',
  severity: 'medium' as 'low' | 'medium' | 'high',
}

export default function AlphaPhase() {
  const [form, setForm] = useState(initialForm)
  const [submitted, setSubmitted] = useState(false)

  const submitMutation = useMutation({
    mutationFn: () =>
      api.post<{ ok: boolean; id: string }>('/fase-alfa/reports', {
        ...form,
        pageUrl: window.location.href,
      }),
    onSuccess: () => {
      setSubmitted(true)
      setForm(initialForm)
      toastSuccess('Reporte enviado. Obrigado por ajudar na Fase Alfa!')
    },
    onError: (err: Error) => {
      toastError(err.message || 'Não foi possível enviar o reporte.')
    },
  })

  const updateField = (field: keyof typeof initialForm, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  const canSubmit = form.title.trim().length >= 4 && form.summary.trim().length >= 10

  return (
    <RadarPageShell maxWidth="wide" className="space-y-6">
      <PageHeader
        title="Fase Alfa"
        subtitle="Ambiente em validação controlada. Use apenas para testes e reporte de erros."
      />

      <SectionCard
        title="Estado atual do projeto"
        description="O Radar Chat está em fase de testes. Planos comerciais ainda não estão valendo."
      >
        <p className="text-sm text-[var(--rz-text-secondary)] mb-4">
          Esta versão concentra validação de atendimento, automações e integrações principais antes do
          go-live comercial. Durante a Fase Alfa, evite dados reais de clientes.
        </p>
        <ul className="grid gap-2 sm:grid-cols-2">
          {ALPHA_PHASE_CURRENT_MODULES.map(item => (
            <li
              key={item}
              className="flex items-start gap-2 rounded-lg border border-[var(--rz-border)] bg-[var(--rz-surface-muted)] px-3 py-2 text-sm text-[var(--rz-text-secondary)]"
            >
              <CheckCircle2 size={16} className="shrink-0 text-[var(--rz-success-text)] mt-0.5" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </SectionCard>

      <SectionCard
        title="Próximos passos"
        description="Roadmap prioritário após estabilização da fase atual."
        actions={<Rocket size={18} className="text-[var(--rz-primary)]" />}
      >
        <div className="space-y-3">
          {ALPHA_PHASE_ROADMAP.map(item => (
            <div
              key={item.id}
              className="rounded-lg border border-[var(--rz-border)] bg-[var(--rz-surface-muted)] p-3"
            >
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <h3 className="text-sm font-semibold text-[var(--rz-text-primary)]">{item.title}</h3>
                <Badge label={roadmapStatusLabel(item.status)} variant="blue" />
              </div>
              <p className="text-sm text-[var(--rz-text-secondary)]">{item.description}</p>
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard title="Regras desta fase">
        <ul className="list-disc list-inside text-sm text-[var(--rz-text-secondary)] space-y-1">
          <li>Use somente dados de teste.</li>
          <li>Não cadastre contatos reais de clientes nesta etapa.</li>
          <li>Evite acionar campanhas ou fluxos de uso definitivo.</li>
          <li>Priorize explorar funcionalidades e validar comportamento.</li>
        </ul>
      </SectionCard>

      <SectionCard title="Benefício para participantes">
        <p className="text-sm text-[var(--rz-text-secondary)]">
          Quem participar ativamente da Fase Alfa terá desconto especial na mensalidade por{' '}
          <strong className="text-[var(--rz-text-primary)]">24 meses</strong>, conforme política
          comercial aplicada no encerramento do período de testes.
        </p>
      </SectionCard>

      <SectionCard
        title="Reportar erro"
        description="Descreva o problema encontrado. Seu reporte será enviado ao painel admin da plataforma."
        actions={<FlaskConical size={18} className="text-amber-400" />}
      >
        {submitted && (
          <p className="mb-4 rounded-lg border border-[var(--rz-success-border)] bg-[var(--rz-success-bg)] px-3 py-2 text-sm text-[var(--rz-success-text)]">
            Reporte registrado com sucesso. Você pode enviar outro se encontrar novos problemas.
          </p>
        )}

        <form
          className="space-y-4"
          onSubmit={e => {
            e.preventDefault()
            if (!canSubmit || submitMutation.isPending) return
            submitMutation.mutate()
          }}
        >
          <div className="grid gap-4 md:grid-cols-2">
            <label className="block space-y-1 md:col-span-2">
              <span className="text-sm text-[var(--rz-text-secondary)]">Título do erro *</span>
              <input
                className={inputCls}
                value={form.title}
                onChange={e => updateField('title', e.target.value)}
                placeholder="Ex.: Inbox não carrega conversa do WebChat"
                maxLength={160}
                required
              />
            </label>

            <label className="block space-y-1">
              <span className="text-sm text-[var(--rz-text-secondary)]">Tela ou canal afetado</span>
              <input
                className={inputCls}
                value={form.affectedArea}
                onChange={e => updateField('affectedArea', e.target.value)}
                placeholder="Ex.: /platform/inbox, WebChat widget"
                maxLength={200}
              />
            </label>

            <label className="block space-y-1">
              <span className="text-sm text-[var(--rz-text-secondary)]">Gravidade</span>
              <select
                className={selectCls}
                value={form.severity}
                onChange={e => updateField('severity', e.target.value)}
              >
                <option value="low">Baixa</option>
                <option value="medium">Média</option>
                <option value="high">Alta</option>
              </select>
            </label>
          </div>

          <label className="block space-y-1">
            <span className="text-sm text-[var(--rz-text-secondary)]">O que aconteceu? *</span>
            <textarea
              className={textareaCls}
              rows={4}
              value={form.summary}
              onChange={e => updateField('summary', e.target.value)}
              placeholder="Descreva o erro com o máximo de detalhes possível."
              maxLength={4000}
              required
            />
          </label>

          <label className="block space-y-1">
            <span className="text-sm text-[var(--rz-text-secondary)]">O que era esperado?</span>
            <textarea
              className={textareaCls}
              rows={3}
              value={form.expectedBehavior}
              onChange={e => updateField('expectedBehavior', e.target.value)}
              placeholder="Descreva o comportamento correto."
              maxLength={2000}
            />
          </label>

          <label className="block space-y-1">
            <span className="text-sm text-[var(--rz-text-secondary)]">Como reproduzir (passo a passo)</span>
            <textarea
              className={textareaCls}
              rows={4}
              value={form.stepsToReproduce}
              onChange={e => updateField('stepsToReproduce', e.target.value)}
              placeholder="1) Abrir Inbox… 2) Selecionar conversa… 3) Clicar em…"
              maxLength={4000}
            />
          </label>

          <button
            type="submit"
            disabled={!canSubmit || submitMutation.isPending}
            className="rounded-lg bg-[var(--rz-primary)] px-4 py-2 text-sm font-medium text-white rz-on-primary hover:opacity-90 disabled:opacity-60"
          >
            {submitMutation.isPending ? 'Enviando…' : 'Enviar reporte para o admin'}
          </button>
        </form>
      </SectionCard>
    </RadarPageShell>
  )
}
