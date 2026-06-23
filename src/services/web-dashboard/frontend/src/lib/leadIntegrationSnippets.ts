export type LeadIntegrationMethod =
  | 'embed'
  | 'api'
  | 'html'
  | 'wordpress'
  | 'builders'

export function panelOrigin(fallback = 'https://SEU-PAINEL'): string {
  if (typeof window !== 'undefined' && window.location.origin) return window.location.origin
  return fallback
}

export function leadPublicApiBase(origin: string): string {
  return `${origin.replace(/\/$/, '')}/api/leads/public`
}

export function embedScriptSnippet(publicKey: string, origin?: string): string {
  const base = origin ?? panelOrigin()
  return `<script src="${base}/leads/form.js" data-form-key="${publicKey}" async></script>`
}

export function embedInContainerSnippet(publicKey: string, containerId: string, origin?: string): string {
  const base = origin ?? panelOrigin()
  return `<div id="${containerId}"></div>
<script src="${base}/leads/form.js" data-form-key="${publicKey}" data-container="${containerId}" async></script>`
}

export function fetchSubmitSnippet(publicKey: string, origin?: string): string {
  const api = leadPublicApiBase(origin ?? panelOrigin())
  return `// Enviar lead de qualquer formulário ou página (fetch)
async function enviarLeadRadarZap(dados) {
  const res = await fetch('${api}/forms/${publicKey}/submit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: dados.name,
      phone: dados.phone,
      email: dados.email || undefined,
      message: dados.message || undefined,
      sourceUrl: window.location.href,
      pageTitle: document.title,
    }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || 'Falha ao enviar');
  return json;
}

// Exemplo de uso após validar seu form:
// await enviarLeadRadarZap({ name: 'Maria', phone: '5511999999999', email: 'maria@email.com' });`
}

export function curlSubmitSnippet(publicKey: string, origin?: string): string {
  const api = leadPublicApiBase(origin ?? panelOrigin())
  return `curl -X POST '${api}/forms/${publicKey}/submit' \\
  -H 'Content-Type: application/json' \\
  -d '{"name":"Maria Silva","phone":"5511999999999","email":"maria@email.com","message":"Quero saber mais","sourceUrl":"https://meusite.com/contato"}'`
}

export function htmlFormSnippet(publicKey: string, origin?: string): string {
  const api = leadPublicApiBase(origin ?? panelOrigin())
  return `<form id="meu-form-lead">
  <input name="name" placeholder="Nome" required />
  <input name="phone" placeholder="WhatsApp" required />
  <input name="email" type="email" placeholder="E-mail" />
  <textarea name="message" placeholder="Mensagem"></textarea>
  <button type="submit">Enviar</button>
  <p id="lead-msg" style="display:none;color:green"></p>
</form>
<script>
document.getElementById('meu-form-lead').addEventListener('submit', async function (e) {
  e.preventDefault();
  var fd = new FormData(e.target);
  var res = await fetch('${api}/forms/${publicKey}/submit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: fd.get('name'),
      phone: fd.get('phone'),
      email: fd.get('email') || undefined,
      message: fd.get('message') || undefined,
      sourceUrl: location.href,
      pageTitle: document.title
    })
  });
  var data = await res.json();
  if (!res.ok) { alert(data.error || 'Erro ao enviar'); return; }
  e.target.reset();
  var msg = document.getElementById('lead-msg');
  msg.textContent = data.successMessage || 'Enviado!';
  msg.style.display = 'block';
});
</script>`
}

export function wordpressEmbedSnippet(publicKey: string, origin?: string): string {
  return `<!-- WordPress: bloco HTML personalizado ou widget HTML (Elementor, etc.) -->
${embedScriptSnippet(publicKey, origin)}

<!--
Passos:
1. Painel WP → Páginas → editar página de contato
2. Adicionar bloco "HTML personalizado" / widget HTML
3. Colar o script acima e publicar
4. Em Leads → Configurar, adicione o domínio do site (ex.: meusite.com.br)
   Lista vazia = qualquer domínio (menos restritivo)
-->`
}

export function wordpressCf7Snippet(publicKey: string, origin?: string): string {
  const api = leadPublicApiBase(origin ?? panelOrigin())
  return `// Contact Form 7 — Aparência → editor de rodapé do formulário, ou plugin "Insert Headers and Footers"
document.addEventListener('wpcf7mailsent', function (event) {
  var inputs = event.detail.inputs || [];
  var get = function (name) {
    var f = inputs.find(function (i) { return i.name === name; });
    return f ? String(f.value || '').trim() : '';
  };
  fetch('${api}/forms/${publicKey}/submit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: get('your-name') || get('nome'),
      phone: get('your-phone') || get('telefone') || get('whatsapp'),
      email: get('your-email') || get('email') || undefined,
      message: get('your-message') || get('mensagem') || undefined,
      sourceUrl: window.location.href,
      pageTitle: document.title
    })
  }).catch(function (err) { console.error('[RadarZap Leads]', err); });
});

// Ajuste os nomes your-name / your-phone conforme os campos do seu CF7`
}

export function wordpressFooterSnippet(publicKey: string, origin?: string): string {
  return `<!-- WordPress: plugin "Insert Headers and Footers" → Footer (site inteiro ou landing) -->
${embedScriptSnippet(publicKey, origin)}
<!-- Coloque em uma página específica usando shortcode HTML ou só na página desejada -->`
}

export function buildersSnippet(publicKey: string, origin?: string): string {
  return `Elementor / Wix / Webflow / RD Station / Typeform
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1) Formulário pronto RadarZap (recomendado)
   Cole em widget HTML / embed:
${embedInContainerSnippet(publicKey, 'radarzap-lead-form', origin)}

2) Formulário do construtor + API
   No evento "após envio" / webhook / JavaScript customizado, chame:
${fetchSubmitSnippet(publicKey, origin).split('\n').slice(0, 3).join('\n')}
   … (copie o snippet completo na aba "API / JavaScript")

3) Domínios permitidos
   Cadastre o domínio publicado (ex.: www.minhaempresa.com.br) em
   Leads → Formulários → Configurar → Domínios permitidos.
   Vazio = aceita qualquer site.`
}

export const LEAD_INTEGRATION_METHODS: Array<{
  id: LeadIntegrationMethod
  label: string
  description: string
}> = [
  {
    id: 'embed',
    label: 'Formulário RadarZap',
    description: 'Nosso padrão — script pronto, visual configurável no painel.',
  },
  {
    id: 'api',
    label: 'API / JavaScript',
    description: 'Integre site customizado, landing ou app enviando JSON.',
  },
  {
    id: 'html',
    label: 'HTML + formulário',
    description: 'Formulário seu com envio via fetch para o RadarZap.',
  },
  {
    id: 'wordpress',
    label: 'WordPress',
    description: 'Bloco HTML, CF7, rodapé global ou Elementor.',
  },
  {
    id: 'builders',
    label: 'Elementor e outros',
    description: 'Construtores de página e ferramentas de marketing.',
  },
]

export function snippetForMethod(
  method: LeadIntegrationMethod,
  publicKey: string,
  origin?: string,
  sub?: string,
): string {
  switch (method) {
    case 'embed':
      return sub === 'container'
        ? embedInContainerSnippet(publicKey, 'radarzap-lead-form', origin)
        : embedScriptSnippet(publicKey, origin)
    case 'api':
      return sub === 'curl' ? curlSubmitSnippet(publicKey, origin) : fetchSubmitSnippet(publicKey, origin)
    case 'html':
      return htmlFormSnippet(publicKey, origin)
    case 'wordpress':
      if (sub === 'cf7') return wordpressCf7Snippet(publicKey, origin)
      if (sub === 'footer') return wordpressFooterSnippet(publicKey, origin)
      return wordpressEmbedSnippet(publicKey, origin)
    case 'builders':
      return buildersSnippet(publicKey, origin)
    default:
      return embedScriptSnippet(publicKey, origin)
  }
}
