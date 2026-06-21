import { Button } from '../../ui/Button'
import { WidgetSectionCard } from '../WebChatWidgetEditorSection'
import { inputCls, textareaCls } from '@/design-system'
import { cn } from '@/lib/utils'
import {
  DEFAULT_WEEKLY_SCHEDULE,
  WEEKDAY_LABEL,
  WEEKDAYS,
  type WebChatWidgetFormState,
  type Weekday,
} from '@/types/webchatWidgetEditor'
import { applyWeekdayBulk, patchScheduleDay } from '@/lib/webchatWidgetEditorUtils'

type Props = {
  form: WebChatWidgetFormState
  onChange: (patch: Partial<WebChatWidgetFormState>) => void
  editorMode: 'simple' | 'advanced'
}

export function WebChatBusinessHoursEditor({ form, onChange, editorMode }: Props) {
  const patchDay = (day: Weekday, field: 'enabled' | 'start' | 'end', value: boolean | string) => {
    onChange({
      schedule: patchScheduleDay(
        form.schedule ?? DEFAULT_WEEKLY_SCHEDULE,
        day,
        field,
        value,
        DEFAULT_WEEKLY_SCHEDULE,
      ),
    })
  }

  const applyWeekdays = () => {
    const mon = form.schedule?.monday ?? DEFAULT_WEEKLY_SCHEDULE.monday
    onChange({
      schedule: applyWeekdayBulk(
        form.schedule ?? DEFAULT_WEEKLY_SCHEDULE,
        ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
        { enabled: true, start: mon.start, end: mon.end },
        DEFAULT_WEEKLY_SCHEDULE,
      ),
    })
  }

  const copyMondayToAll = () => {
    const mon = form.schedule?.monday ?? DEFAULT_WEEKLY_SCHEDULE.monday
    onChange({
      schedule: applyWeekdayBulk(
        form.schedule ?? DEFAULT_WEEKLY_SCHEDULE,
        WEEKDAYS,
        { enabled: mon.enabled, start: mon.start, end: mon.end },
        DEFAULT_WEEKLY_SCHEDULE,
      ),
    })
  }

  const clearAll = () => {
    onChange({
      schedule: applyWeekdayBulk(
        form.schedule ?? DEFAULT_WEEKLY_SCHEDULE,
        WEEKDAYS,
        { enabled: false },
        DEFAULT_WEEKLY_SCHEDULE,
      ),
    })
  }

  const scheduleInvalid =
    !form.useInboxBusinessHours &&
    form.businessHoursEnabled &&
    WEEKDAYS.some(day => {
      const d = form.schedule?.[day]
      return d?.enabled && d.start >= d.end
    })

  return (
    <div className="space-y-4">
      <WidgetSectionCard
        title="Modo simples"
        description="Escolha como o horário de atendimento funciona neste widget."
      >
        <label className="flex items-center gap-2 text-sm text-[var(--rz-text)]">
          <input
            type="radio"
            name="hours-mode"
            checked={form.useInboxBusinessHours}
            onChange={() =>
              onChange({ useInboxBusinessHours: true, businessHoursEnabled: false })
            }
          />
          Usar o mesmo horário do atendimento principal (caixa de entrada / WhatsApp)
        </label>
        <label className="flex items-center gap-2 text-sm text-[var(--rz-text)]">
          <input
            type="radio"
            name="hours-mode"
            checked={!form.useInboxBusinessHours && !form.businessHoursEnabled}
            onChange={() =>
              onChange({ useInboxBusinessHours: false, businessHoursEnabled: false })
            }
          />
          Atendimento sempre disponível (24h)
        </label>
        <label className="flex items-center gap-2 text-sm text-[var(--rz-text)]">
          <input
            type="radio"
            name="hours-mode"
            checked={!form.useInboxBusinessHours && form.businessHoursEnabled}
            onChange={() =>
              onChange({ useInboxBusinessHours: false, businessHoursEnabled: true })
            }
          />
          Atendimento em horário comercial (personalizado neste widget)
        </label>
        <p className="text-[10px] text-[var(--rz-text-muted)]">
          Fora do horário, o visitante ainda pode enviar mensagem, mas receberá a resposta automática
          configurada.
        </p>
      </WidgetSectionCard>

      {!form.useInboxBusinessHours && form.businessHoursEnabled && (
        <WidgetSectionCard
          title={editorMode === 'advanced' ? 'Horário personalizado' : 'Horário comercial'}
          description="Defina os dias e horários em que a equipe está disponível."
        >
          {editorMode === 'advanced' && (
            <>
              <label className="block text-xs font-medium text-[var(--rz-text-muted)]">
                Fuso horário
                <input
                  className={inputCls + ' mt-1'}
                  value={form.timezone}
                  onChange={e => onChange({ timezone: e.target.value })}
                  placeholder="America/Sao_Paulo"
                />
              </label>
              <label className="block text-xs font-medium text-[var(--rz-text-muted)]">
                Mensagem fora do horário
                <textarea
                  className={textareaCls + ' mt-1'}
                  rows={2}
                  value={form.outsideHoursMessage}
                  onChange={e => onChange({ outsideHoursMessage: e.target.value })}
                />
              </label>
            </>
          )}

          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="secondary" size="sm" onClick={applyWeekdays}>
              Aplicar segunda a sexta
            </Button>
            <Button type="button" variant="secondary" size="sm" onClick={copyMondayToAll}>
              Copiar horário para todos
            </Button>
            <Button type="button" variant="secondary" size="sm" onClick={clearAll}>
              Limpar horários
            </Button>
          </div>

          {scheduleInvalid && (
            <p className="text-xs text-amber-400">
              Verifique os horários: o início deve ser anterior ao fim em cada dia ativo.
            </p>
          )}

          <div className="space-y-1">
            {WEEKDAYS.map(day => {
              const daySchedule = form.schedule?.[day] ?? DEFAULT_WEEKLY_SCHEDULE[day]
              const invalid =
                daySchedule.enabled && daySchedule.start >= daySchedule.end
              return (
                <div
                  key={day}
                  className={cn(
                    'flex flex-wrap items-center gap-3 border-b border-[var(--rz-border)]/80 py-2 last:border-0',
                    invalid && 'bg-amber-500/5',
                  )}
                >
                  <label className="flex w-28 items-center gap-2 text-sm text-[var(--rz-text)]">
                    <input
                      type="checkbox"
                      checked={daySchedule.enabled}
                      onChange={e => patchDay(day, 'enabled', e.target.checked)}
                    />
                    {WEEKDAY_LABEL[day]}
                  </label>
                  <input
                    type="time"
                    className={cn(inputCls, 'w-auto px-2 py-1 text-xs')}
                    value={daySchedule.start}
                    disabled={!daySchedule.enabled}
                    onChange={e => patchDay(day, 'start', e.target.value)}
                  />
                  <span className="text-xs text-[var(--rz-text-muted)]">até</span>
                  <input
                    type="time"
                    className={cn(inputCls, 'w-auto px-2 py-1 text-xs')}
                    value={daySchedule.end}
                    disabled={!daySchedule.enabled}
                    onChange={e => patchDay(day, 'end', e.target.value)}
                  />
                </div>
              )
            })}
          </div>
        </WidgetSectionCard>
      )}
    </div>
  )
}
