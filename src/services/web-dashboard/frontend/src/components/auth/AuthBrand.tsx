import { BrandLogo } from '../brand/BrandLogo'

/** Marca Radar Chat compartilhada nas telas de autenticação. */
export function AuthBrand({
  subtitle,
  tone = 'auto',
}: {
  subtitle?: string
  tone?: 'light' | 'dark' | 'auto'
}) {
  return (
    <div className="rz-auth-brand select-none">
      <BrandLogo height={48} animated className="rz-auth-brand-logo shrink-0" tone={tone} />
      <div className="min-w-0">
        <p className="rz-auth-brand-name">
          <span>Radar </span>
          <span className="text-[#00D4FF]">Chat</span>
        </p>
        {subtitle ? <p className="rz-auth-brand-tag">{subtitle}</p> : null}
      </div>
    </div>
  )
}
