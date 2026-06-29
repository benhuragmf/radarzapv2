/** Marca Radar Chat compartilhada nas telas de autenticação. */
export function AuthBrand({ subtitle }: { subtitle?: string }) {
  return (
    <div className="rz-auth-brand select-none">
      <img src="/favicon.svg" alt="" width={44} height={42} className="rz-auth-brand-logo" aria-hidden />
      <div>
        <p className="rz-auth-brand-name">Radar Chat</p>
        {subtitle ? <p className="rz-auth-brand-tag">{subtitle}</p> : null}
      </div>
    </div>
  )
}
