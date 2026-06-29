import { EmbedAllowedDomainsFields } from './EmbedAllowedDomainsFields'

type Props = {
  title?: string
  description?: string
  includeCompanyWebsite: boolean
  onIncludeCompanyWebsiteChange: (value: boolean) => void
  extraDomains: string[]
  onExtraDomainsChange: (domains: string[]) => void
  companyWebsite?: string
  textareaCls: string
  id?: string
}

export function EmbedSitesSection({
  title = 'Sites onde este embed pode aparecer',
  description = 'Primeiro passo: defina onde o script pode carregar. O site em Configurações → Empresa entra automaticamente quando marcado abaixo.',
  ...fields
}: Props) {
  return (
    <div className="space-y-3">
      {title ? (
        <div>
          <h3 className="text-sm font-semibold text-[var(--rz-text-primary)]">{title}</h3>
          {description ? (
            <p className="mt-0.5 text-xs leading-relaxed text-[var(--rz-text-muted)]">{description}</p>
          ) : null}
        </div>
      ) : description ? (
        <p className="text-xs leading-relaxed text-[var(--rz-text-muted)]">{description}</p>
      ) : null}
      <EmbedAllowedDomainsFields {...fields} />
    </div>
  )
}
