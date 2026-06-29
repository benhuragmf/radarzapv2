import { panelOrigin } from './leadIntegrationSnippets'

export type WebChatIntegrationMethod = 'embed' | 'api' | 'html' | 'wordpress' | 'builders'

export function webchatPublicApiBase(origin: string): string {
  return `${origin.replace(/\/$/, '')}/api/webchat/public`
}

export function webchatWidgetScriptSnippet(publicKey: string, origin?: string): string {
  const base = (origin ?? panelOrigin()).replace(/\/$/, '')
  return `<script src="${base}/webchat/widget.js" data-widget-key="${publicKey}" data-base-url="${base}" async></script>`
}

export function webchatPreviewPageUrl(publicKey: string, origin?: string): string {
  const base = (origin ?? panelOrigin()).replace(/\/$/, '')
  return `${base}/webchat/widget.html?key=${encodeURIComponent(publicKey)}`
}

export function webchatSessionFetchSnippet(publicKey: string, origin?: string): string {
  const api = webchatPublicApiBase(origin ?? panelOrigin())
  return `// Abrir sessão de chat (visitante)
async function abrirChatRadarChat() {
  const res = await fetch('${api}/widgets/${publicKey}/sessions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      visitorName: 'Visitante',
      pageUrl: window.location.href,
      pageTitle: document.title,
    }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || 'Falha ao abrir chat');
  return json; // visitorToken, conversationId, messages…
}`
}

export function webchatCurlConfigSnippet(publicKey: string, origin?: string): string {
  const api = webchatPublicApiBase(origin ?? panelOrigin())
  return `curl '${api}/widgets/${publicKey}/config' \\
  -H 'Origin: https://meusite.com.br'`
}

export function webchatHtmlLandingSnippet(publicKey: string, origin?: string): string {
  const base = (origin ?? panelOrigin()).replace(/\/$/, '')
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <title>Chat ao vivo</title>
</head>
<body>
  <h1>Fale conosco</h1>
  <p>O chat abre no canto da página.</p>
  <script src="${base}/webchat/widget.js" data-widget-key="${publicKey}" data-base-url="${base}" async></script>
</body>
</html>`
}

export function webchatWordpressSnippet(publicKey: string, origin?: string): string {
  return `<!-- WordPress: bloco HTML personalizado ou widget HTML -->
${webchatWidgetScriptSnippet(publicKey, origin)}

<!--
1. Painel WP → Aparência → Editor de temas → footer.php antes de </body>
   OU plugin "Insert Headers and Footers" → Footer
2. Ou bloco HTML na página desejada (Elementor, etc.)
3. Em WebChat → Visão geral, configure os domínios permitidos
-->`
}

export function webchatBuildersSnippet(publicKey: string, origin?: string): string {
  return `Elementor / Wix / Webflow / landing pages
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1) Widget pronto (recomendado)
   Cole em widget HTML / embed antes de </body>:
${webchatWidgetScriptSnippet(publicKey, origin)}

2) Pré-visualização
   ${webchatPreviewPageUrl(publicKey, origin)}

3) Domínios
   Configure em WebChat → widget → Visão geral → Sites permitidos.
   Desmarque "Incluir site da empresa" se o widget for só de outro domínio.`
}

export const WEBCHAT_INTEGRATION_METHODS: Array<{
  id: WebChatIntegrationMethod
  label: string
  description: string
}> = [
  {
    id: 'embed',
    label: 'Chat Radar Chat',
    description: 'Nosso padrão — script pronto, visual configurável no painel.',
  },
  {
    id: 'api',
    label: 'API / JavaScript',
    description: 'Integre app ou landing customizada via API pública.',
  },
  {
    id: 'html',
    label: 'HTML mínimo',
    description: 'Página de exemplo com o widget embed.',
  },
  {
    id: 'wordpress',
    label: 'WordPress',
    description: 'Bloco HTML, rodapé global ou Elementor.',
  },
  {
    id: 'builders',
    label: 'Elementor e outros',
    description: 'Construtores de página e ferramentas de marketing.',
  },
]

export function webchatSnippetForMethod(
  method: WebChatIntegrationMethod,
  publicKey: string,
  origin?: string,
  sub?: string,
): string {
  switch (method) {
    case 'embed':
      return webchatWidgetScriptSnippet(publicKey, origin)
    case 'api':
      return sub === 'curl' ? webchatCurlConfigSnippet(publicKey, origin) : webchatSessionFetchSnippet(publicKey, origin)
    case 'html':
      return webchatHtmlLandingSnippet(publicKey, origin)
    case 'wordpress':
      return webchatWordpressSnippet(publicKey, origin)
    case 'builders':
      return webchatBuildersSnippet(publicKey, origin)
    default:
      return webchatWidgetScriptSnippet(publicKey, origin)
  }
}
