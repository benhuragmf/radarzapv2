import { useState } from 'react'
import { CheckCircle2, Copy, HelpCircle, Key } from 'lucide-react'
import { Button } from '../../ui/Button'
import { WidgetSectionCard } from '../WebChatWidgetEditorSection'
import { textareaCls } from '@/design-system'
import { notifySuccess } from '@/lib/notify'

type Props = {
  snippet: string
  publicKey: string
}

export function WebChatInstallSection({ snippet, publicKey }: Props) {
  const [scriptCopied, setScriptCopied] = useState(false)
  const [keyCopied, setKeyCopied] = useState(false)
  const [testUrl, setTestUrl] = useState('')
  const [showInstructions, setShowInstructions] = useState(true)

  const copyScript = async () => {
    await navigator.clipboard.writeText(snippet)
    setScriptCopied(true)
    notifySuccess('Script copiado')
    setTimeout(() => setScriptCopied(false), 3000)
  }

  const copyKey = async () => {
    await navigator.clipboard.writeText(publicKey)
    setKeyCopied(true)
    notifySuccess('Chave do widget copiada')
    setTimeout(() => setKeyCopied(false), 3000)
  }

  return (
    <div className="space-y-4">
      <WidgetSectionCard
        title="Script de instalação"
        description="Cole este código no HTML do seu site para exibir o chat."
      >
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="secondary" size="sm" onClick={copyScript}>
            <Copy className="h-4 w-4" />
            {scriptCopied ? 'Copiado!' : 'Copiar script'}
          </Button>
          <Button type="button" variant="secondary" size="sm" onClick={copyKey}>
            <Key className="h-4 w-4" />
            {keyCopied ? 'Copiado!' : 'Copiar apenas a chave'}
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => setShowInstructions(v => !v)}
          >
            <HelpCircle className="h-4 w-4" />
            {showInstructions ? 'Ocultar instruções' : 'Ver instruções'}
          </Button>
        </div>
        <textarea
          className={textareaCls + ' font-mono text-xs bg-[var(--rz-surface-muted)]/40'}
          readOnly
          rows={4}
          value={snippet}
        />
        {scriptCopied && (
          <p className="flex items-center gap-1.5 text-xs text-emerald-400">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Script copiado — publique no site e teste o widget.
          </p>
        )}
      </WidgetSectionCard>

      {showInstructions && (
        <WidgetSectionCard title="Como instalar" description="Passo a passo para colocar o chat no ar.">
          <ol className="list-decimal space-y-2 pl-4 text-sm text-[var(--rz-text-secondary)]">
            <li>Copie o script acima.</li>
            <li>
              Cole antes do fechamento da tag <code className="text-brand-300">&lt;/body&gt;</code> em
              todas as páginas do site.
            </li>
            <li>Publique ou atualize o site.</li>
            <li>Volte aqui e use &quot;Testar widget&quot; para validar a aparência.</li>
          </ol>
        </WidgetSectionCard>
      )}

      <WidgetSectionCard
        title="Teste de instalação"
        description="Verificação automática em breve. Por enquanto, informe a URL e abra no navegador."
      >
        <label className="block text-xs font-medium text-[var(--rz-text-muted)]">
          URL do site (opcional)
          <input
            className="mt-1 w-full rounded-lg border border-[var(--rz-border)] bg-[var(--rz-surface)] px-3 py-2 text-sm"
            value={testUrl}
            onChange={e => setTestUrl(e.target.value)}
            placeholder="https://meusite.com.br"
          />
        </label>
        <p className="text-[10px] text-[var(--rz-text-muted)]">
          A verificação automática do script (instalado / domínio não permitido) requer endpoint no
          backend — use o teste manual abrindo o site após publicar.
        </p>
      </WidgetSectionCard>

      <WidgetSectionCard title="Ambientes" description="Onde o widget costuma ser usado.">
        <ul className="space-y-2 text-xs text-[var(--rz-text-secondary)]">
          <li>
            <strong className="text-[var(--rz-text-primary)]">Produção</strong> — domínio público do
            site (recomendado restringir domínios na aba Avançado).
          </li>
          <li>
            <strong className="text-[var(--rz-text-primary)]">Desenvolvimento</strong> — localhost ou
            staging; deixe domínios vazios ou inclua <code>localhost</code>.
          </li>
        </ul>
      </WidgetSectionCard>
    </div>
  )
}
