import {
  buildGoogleMapsUrl,
  buildManualDeliveryCopyText,
  deliveryAddressV1HumanLabel,
  evaluatePinAddressDivergence,
  formatDeliveryAddressV1DetailLines,
  isDeliveryAddressV1ConfirmedForHuman,
  pinLocationSourceLabel,
} from '@radarchat-types/catalog-delivery-human.util'
import { notifyInfo } from '../../lib/notify'

export interface DeliveryAddressV1View {
  status?: string
  source?: string
  confidence?: string
  formattedAddress?: string
  street?: string
  number?: string
  neighborhood?: string
  city?: string
  uf?: string
  state?: string
  zipCode?: string
  complement?: string
  reference?: string
  confirmedAt?: string
  confirmedBy?: string
  latitude?: number
  longitude?: number
  mapsUrl?: string
}

export interface DeliveryAddressSnapshotView {
  formattedAddress: string
  deliveryFee?: string
  totalAmount?: string
  deliveryDistanceKm?: number
  deliveryTierKm?: number
  capturedAt?: string
}

export interface CatalogDeliveryHumanPanelProps {
  orderCode?: string | null
  contactName?: string
  channel?: string
  deliveryAddress?: string
  deliveryAddressV1?: DeliveryAddressV1View | null
  deliveryAddressSnapshot?: DeliveryAddressSnapshotView | null
  deliveryLocationLat?: number
  deliveryLocationLng?: number
  deliveryLocationPendingConfirm?: boolean
  deliveryFee?: string
  totalAmount?: string
  deliveryDistanceKm?: number
  deliveryTierKm?: number
  compact?: boolean
}

function formatConfirmedAt(iso?: string): string | null {
  if (!iso) return null
  try {
    return new Date(iso).toLocaleString('pt-BR')
  } catch {
    return iso
  }
}

async function copyText(label: string, text: string) {
  await navigator.clipboard?.writeText(text)
  notifyInfo(`${label} copiado.`)
}

export function CatalogDeliveryHumanPanel({
  orderCode,
  contactName,
  channel,
  deliveryAddress,
  deliveryAddressV1,
  deliveryAddressSnapshot,
  deliveryLocationLat,
  deliveryLocationLng,
  deliveryLocationPendingConfirm,
  deliveryFee,
  totalAmount,
  deliveryDistanceKm,
  deliveryTierKm,
  compact = false,
}: CatalogDeliveryHumanPanelProps) {
  const hasPin = deliveryLocationLat != null && deliveryLocationLng != null
  const addressConfirmed = isDeliveryAddressV1ConfirmedForHuman(deliveryAddressV1)
  const addressLines = formatDeliveryAddressV1DetailLines(deliveryAddressV1)
  const hasAddressText =
    addressLines.length > 0 || Boolean(deliveryAddressV1?.formattedAddress || deliveryAddress)

  const divergence = evaluatePinAddressDivergence({
    pinLat: deliveryLocationLat,
    pinLng: deliveryLocationLng,
    addressV1: deliveryAddressV1,
  })

  const pinMapsUrl =
    hasPin && deliveryLocationLat != null && deliveryLocationLng != null
      ? buildGoogleMapsUrl(deliveryLocationLat, deliveryLocationLng)
      : null

  const manualCopy = buildManualDeliveryCopyText({
    orderCode,
    contactName,
    deliveryAddressV1,
    deliveryAddress,
    pinLat: deliveryLocationLat,
    pinLng: deliveryLocationLng,
    deliveryFee,
    totalAmount,
    snapshotDeliveryFee: deliveryAddressSnapshot?.deliveryFee,
    snapshotTotal: deliveryAddressSnapshot?.totalAmount,
  })

  if (!hasAddressText && !hasPin && !deliveryAddressSnapshot?.formattedAddress) {
    return null
  }

  return (
    <div className={`space-y-3 ${compact ? 'text-xs' : 'text-sm'}`}>
      {hasAddressText && (
        <div className="rounded-md border border-sky-800/40 bg-sky-950/25 p-3 space-y-1.5">
          <p className="font-medium text-sky-100">
            {addressConfirmed
              ? 'Endereço confirmado para entrega'
              : 'Endereço informado (aguardando confirmação)'}
          </p>
          {addressLines.length > 0 ? (
            <ul className="text-[var(--rz-text-muted)] space-y-0.5">
              {addressLines.map(line => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          ) : (
            <p className="text-[var(--rz-text-muted)]">
              {deliveryAddressV1?.formattedAddress || deliveryAddress}
            </p>
          )}
          <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-[var(--rz-text-muted)]">
            {deliveryAddressV1?.status && (
              <span>Status: {deliveryAddressV1HumanLabel(deliveryAddressV1)}</span>
            )}
            {deliveryAddressV1?.source && <span>Origem: {deliveryAddressV1.source}</span>}
            {deliveryAddressV1?.confirmedAt && (
              <span>Confirmado em: {formatConfirmedAt(deliveryAddressV1.confirmedAt)}</span>
            )}
            {deliveryAddressV1?.confirmedBy && (
              <span>Por: {deliveryAddressV1.confirmedBy}</span>
            )}
          </div>
          {addressConfirmed && (
            <button
              type="button"
              className="underline text-brand-400 text-xs"
              onClick={() =>
                void copyText(
                  'Endereço',
                  deliveryAddressV1?.formattedAddress || deliveryAddress || '',
                )
              }
            >
              Copiar endereço confirmado
            </button>
          )}
        </div>
      )}

      {hasPin && deliveryLocationLat != null && deliveryLocationLng != null && (
        <div className="rounded-md border border-emerald-800/40 bg-emerald-950/25 p-3 space-y-1.5">
          <p className="font-medium text-emerald-100">Localização enviada pelo cliente</p>
          <p className="font-mono text-xs text-[var(--rz-text-muted)]">
            {deliveryLocationLat.toFixed(6)}, {deliveryLocationLng.toFixed(6)}
          </p>
          <p className="text-xs text-[var(--rz-text-muted)]">
            Origem: {pinLocationSourceLabel(deliveryAddressV1?.source, channel)}
          </p>
          {(deliveryLocationPendingConfirm || !addressConfirmed) && (
            <p className="text-xs text-amber-300/90">
              Este pin ainda não foi confirmado como endereço final de entrega.
            </p>
          )}
          <div className="flex flex-wrap gap-2 pt-1">
            {pinMapsUrl && (
              <a
                href={pinMapsUrl}
                target="_blank"
                rel="noreferrer"
                className="underline text-brand-400 text-xs"
              >
                Abrir no Google Maps
              </a>
            )}
            <button
              type="button"
              className="underline text-brand-400 text-xs"
              onClick={() =>
                void copyText(
                  'Coordenadas',
                  `${deliveryLocationLat.toFixed(6)}, ${deliveryLocationLng.toFixed(6)}`,
                )
              }
            >
              Copiar coordenadas
            </button>
          </div>
        </div>
      )}

      {divergence.level === 'warn' && (
        <p className="text-xs rounded-md border border-amber-600/50 bg-amber-950/40 text-amber-200 p-2">
          {divergence.message}
          {divergence.distanceMeters != null ? ` (~${divergence.distanceMeters} m)` : ''}
        </p>
      )}
      {divergence.level === 'manual' && hasPin && (
        <p className="text-xs rounded-md border border-amber-700/40 bg-amber-950/30 text-amber-200/90 p-2">
          {divergence.message}
        </p>
      )}

      {(deliveryAddressSnapshot?.formattedAddress || deliveryFee || deliveryDistanceKm != null) && (
        <div className="rounded-md border border-[var(--rz-border)] bg-[var(--rz-surface-muted)]/40 p-3 space-y-1">
          <p className="font-medium text-[var(--rz-text-secondary)]">Frete congelado no pedido</p>
          {deliveryAddressSnapshot?.formattedAddress && (
            <p className="text-xs text-[var(--rz-text-muted)]">
              Snapshot: {deliveryAddressSnapshot.formattedAddress}
            </p>
          )}
          <div className="flex flex-wrap gap-x-3 text-xs text-[var(--rz-text-muted)]">
            {(deliveryAddressSnapshot?.deliveryFee || deliveryFee) && (
              <span>Frete: {deliveryAddressSnapshot?.deliveryFee || deliveryFee}</span>
            )}
            {(deliveryAddressSnapshot?.totalAmount || totalAmount) && (
              <span>Total: {deliveryAddressSnapshot?.totalAmount || totalAmount}</span>
            )}
            {(deliveryAddressSnapshot?.deliveryDistanceKm ?? deliveryDistanceKm) != null && (
              <span>
                ~{deliveryAddressSnapshot?.deliveryDistanceKm ?? deliveryDistanceKm} km
                {(deliveryAddressSnapshot?.deliveryTierKm ?? deliveryTierKm) != null
                  ? ` · faixa ${deliveryAddressSnapshot?.deliveryTierKm ?? deliveryTierKm} km`
                  : ''}
              </span>
            )}
          </div>
        </div>
      )}

      <div className="pt-1">
        <button
          type="button"
          className="inline-flex items-center justify-center rounded-md border border-[var(--rz-border)] px-2.5 py-1.5 text-xs hover:bg-[var(--rz-surface-muted)]"
          onClick={() => void copyText('Dados para entrega manual', manualCopy)}
        >
          Copiar dados para entrega manual
        </button>
        <p className="text-[10px] text-[var(--rz-text-muted)] mt-1">
          Apenas cópia para repasse manual — sem envio automático para entregador.
        </p>
      </div>
    </div>
  )
}
