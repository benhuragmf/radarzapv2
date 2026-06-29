import { Link } from 'react-router-dom'
import { formatCompanyWebsiteHosts } from '@/lib/embedAllowedDomains'

type Props = {
  includeCompanyWebsite: boolean
  onIncludeCompanyWebsiteChange: (value: boolean) => void
  extraDomains: string[]
  onExtraDomainsChange: (domains: string[]) => void
  companyWebsite?: string
  textareaCls: string
  id?: string
}

export function EmbedAllowedDomainsFields({
  includeCompanyWebsite,
  onIncludeCompanyWebsiteChange,
  extraDomains,
  onExtraDomainsChange,
  companyWebsite,
  textareaCls,
  id = 'embed-extra-domains',
}: Props) {
  const companyHosts = formatCompanyWebsiteHosts(companyWebsite)
  const hasCompanySite = companyHosts.length > 0
  const effectiveHint =
    includeCompanyWebsite && hasCompanySite
      ? companyHosts
      : includeCompanyWebsite
        ? null
        : null

  return (
    <div className="space-y-3">
      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          className="mt-0.5"
          checked={includeCompanyWebsite}
          onChange={e => onIncludeCompanyWebsiteChange(e.target.checked)}
        />
        <span>
          Incluir site da empresa
          {hasCompanySite ? (
            <span className="block text-xs text-[var(--rz-text-muted)] font-mono mt-0.5">{companyHosts}</span>
          ) : (
            <span className="block text-xs text-[var(--rz-text-muted)] mt-0.5">
              Cadastre o site em{' '}
              <Link to="/settings#empresa" className="text-[var(--rz-primary)] underline">
                Configurações → Empresa
              </Link>
              .
            </span>
          )}
        </span>
      </label>

      <div>
        <label htmlFor={id} className="text-xs text-[var(--rz-text-muted)] block mb-1">
          Domínios adicionais (um por linha)
        </label>
        <textarea
          id={id}
          className={textareaCls + ' font-mono text-xs'}
          rows={4}
          placeholder="outrosite.com.br&#10;landing.outrosite.com.br"
          value={extraDomains.join('\n')}
          onChange={e =>
            onExtraDomainsChange(
              e.target.value
                .split(/[\n,;]+/)
                .map(s => s.trim())
                .filter(Boolean),
            )
          }
        />
        <p className="text-xs text-[var(--rz-text-muted)] mt-1">
          Use para outro site ou landing — desmarque &quot;Incluir site da empresa&quot; se este embed for{' '}
          <strong>somente</strong> para outro domínio.
        </p>
      </div>

      {!includeCompanyWebsite && !extraDomains.length && (
        <p className="text-xs text-amber-700 dark:text-amber-300">
          Nenhum domínio efetivo — em produção o embed ficará bloqueado até incluir o site da empresa ou
          informar domínios adicionais.
        </p>
      )}

      {effectiveHint && !extraDomains.length && (
        <p className="text-xs text-emerald-700 dark:text-emerald-300">
          Liberado automaticamente em: {effectiveHint}
        </p>
      )}
    </div>
  )
}
