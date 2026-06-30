import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from '../../lib/api'
import { notifyError } from '../../lib/notify'
import {
  CATALOG_DELIVERY_ADDRESS_HINT,
  deliveryAddressValidationError,
  emptyDeliveryAddress,
  formatDeliveryAddress,
  parseDeliveryAddress,
  type DeliveryAddressStructured,
} from '@radarzap-types/catalog-delivery-address'

const inputCls =
  'w-full rounded-md border border-[var(--rz-border)] bg-[var(--rz-surface)] px-3 py-2 text-sm text-[var(--rz-text-primary)] placeholder:text-[var(--rz-text-muted)] focus:outline-none focus:ring-2 focus:ring-brand-500/40'

interface BrCepLookupResponse {
  cep: string
  street: string
  neighborhood: string
  city: string
  state: string
  complement?: string
}

interface Props {
  value: string
  onChange: (canonical: string) => void
  showValidation?: boolean
  inputClassName?: string
  disabled?: boolean
  cepLookupPath?: string
}

export function DeliveryOriginAddressFields({
  value,
  onChange,
  showValidation = false,
  inputClassName = inputCls,
  disabled = false,
  cepLookupPath = '/organization/lookup-cep',
}: Props) {
  const [fields, setFields] = useState<DeliveryAddressStructured>(() =>
    parseDeliveryAddress(value) ?? emptyDeliveryAddress(),
  )
  const [cepLoading, setCepLoading] = useState(false)
  const lastEmitted = useRef(value)

  useEffect(() => {
    if (value === lastEmitted.current) return
    lastEmitted.current = value
    setFields(parseDeliveryAddress(value) ?? emptyDeliveryAddress())
  }, [value])

  const emit = useCallback(
    (next: DeliveryAddressStructured) => {
      setFields(next)
      const canonical = formatDeliveryAddress(next)
      lastEmitted.current = canonical
      onChange(canonical)
    },
    [onChange],
  )

  const patch = (patchFields: Partial<DeliveryAddressStructured>) => {
    emit({ ...fields, ...patchFields })
  }

  const lookupCep = async (cepRaw: string) => {
    const digits = cepRaw.replace(/\D/g, '')
    if (digits.length !== 8) return
    setCepLoading(true)
    try {
      const data = await api.get<BrCepLookupResponse>(
        `${cepLookupPath}?cep=${encodeURIComponent(digits)}`,
      )
      emit({
        ...fields,
        cep: digits,
        street: data.street || fields.street,
        neighborhood: data.neighborhood || fields.neighborhood,
        city: data.city || fields.city,
        state: data.state || fields.state,
      })
    } catch {
      notifyError('CEP não encontrado. Confira os dígitos e tente de novo.')
    } finally {
      setCepLoading(false)
    }
  }

  const onCepChange = (raw: string) => {
    const digits = raw.replace(/\D/g, '').slice(0, 8)
    patch({ cep: digits })
    if (digits.length === 8) void lookupCep(digits)
  }

  const validationErr = showValidation ? deliveryAddressValidationError(value) : null

  return (
    <div className="space-y-2">
      <p className="text-xs text-[var(--rz-text-muted)]">
        {CATALOG_DELIVERY_ADDRESS_HINT} O CEP preenche rua, bairro, cidade e estado automaticamente.
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="text-xs space-y-1 sm:col-span-1">
          <span className="text-[var(--rz-text-muted)]">CEP *</span>
          <input
            className={inputClassName}
            disabled={disabled}
            value={
              fields.cep.length > 5
                ? `${fields.cep.slice(0, 5)}-${fields.cep.slice(5)}`
                : fields.cep
            }
            onChange={e => onCepChange(e.target.value)}
            onBlur={() => {
              if (fields.cep.replace(/\D/g, '').length === 8) void lookupCep(fields.cep)
            }}
            placeholder="00000-000"
            inputMode="numeric"
            autoComplete="postal-code"
          />
          {cepLoading && (
            <span className="text-[10px] text-brand-400">Buscando endereço…</span>
          )}
        </label>
        <label className="text-xs space-y-1">
          <span className="text-[var(--rz-text-muted)]">Número *</span>
          <input
            className={inputClassName}
            disabled={disabled}
            value={fields.number}
            onChange={e => patch({ number: e.target.value })}
            placeholder="120"
          />
        </label>
        <label className="text-xs space-y-1 sm:col-span-2">
          <span className="text-[var(--rz-text-muted)]">Rua / logradouro *</span>
          <input
            className={inputClassName}
            disabled={disabled}
            value={fields.street}
            onChange={e => patch({ street: e.target.value })}
            placeholder="Preenchido pelo CEP"
          />
        </label>
        <label className="text-xs space-y-1">
          <span className="text-[var(--rz-text-muted)]">Bairro *</span>
          <input
            className={inputClassName}
            disabled={disabled}
            value={fields.neighborhood}
            onChange={e => patch({ neighborhood: e.target.value })}
            placeholder="Centro"
          />
        </label>
        <label className="text-xs space-y-1">
          <span className="text-[var(--rz-text-muted)]">Complemento</span>
          <input
            className={inputClassName}
            disabled={disabled}
            value={fields.complement ?? ''}
            onChange={e => patch({ complement: e.target.value })}
            placeholder="Sala, bloco (opcional)"
          />
        </label>
        <label className="text-xs space-y-1">
          <span className="text-[var(--rz-text-muted)]">Cidade *</span>
          <input
            className={inputClassName}
            disabled={disabled}
            value={fields.city}
            onChange={e => patch({ city: e.target.value })}
            placeholder="São Paulo"
          />
        </label>
        <label className="text-xs space-y-1">
          <span className="text-[var(--rz-text-muted)]">Estado (UF) *</span>
          <input
            className={inputClassName}
            disabled={disabled}
            value={fields.state}
            onChange={e => patch({ state: e.target.value.toUpperCase().slice(0, 2) })}
            placeholder="SP"
            maxLength={2}
          />
        </label>
      </div>
      {validationErr && <p className="text-xs text-amber-400">{validationErr}</p>}
    </div>
  )
}
