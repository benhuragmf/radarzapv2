# RadarZap — Design System (painel frontend)

**Versão:** 2.8.4+ · **Código:** `src/services/web-dashboard/frontend/src/design-system/`

O painel usa tokens CSS `--rz-*`, componentes compartilhados e helpers de classe. Tema claro/escuro via `html[data-theme='light']`.

---

## Onde importar

```ts
import {
  RadarPageShell,
  PageHeader,
  inputCls,
  selectCls,
  waPreviewPanelCls,
  searchFieldIconCls,
  logLineMetaCls,
} from '@/design-system'
```

Alias `@/` → `frontend/src/` (Vite + tsconfig).

---

## Tokens principais (`index.css`)

| Token | Uso |
|-------|-----|
| `--rz-background`, `--rz-surface`, `--rz-surface-muted` | Fundos de página e cards |
| `--rz-border` | Bordas |
| `--rz-text-primary/secondary/muted` | Tipografia |
| `--rz-primary`, `--rz-primary-hover` | Ações principais |
| `--rz-success/warning/danger/info` + `*-bg` / `*-text` | Status semânticos |
| `--rz-on-accent`, `--rz-on-light-surface` | Texto sobre fundos claros ou badge amarelo |
| `--rz-sidebar-*` | Sidebar sempre escura (`.rz-sidebar`) |

### Preview externo (não segue tema do painel)

| Token / classe | Uso |
|----------------|-----|
| `--rz-wa-*`, `.rz-wa-preview-panel`, `.rz-wa-preview-bubble` | Mock WhatsApp |
| `--rz-discord-*`, `.rz-discord-preview-panel` | Mock Discord |
| `--rz-oauth-discord`, `.rz-oauth-btn-*` | Login Google/Discord |
| `.rz-qr-frame` | QR code WhatsApp (fundo branco fixo) |

Paleta de cores de **status WA** (produto): `lib/wa-status-colors.ts`.

---

## Componentes

| Componente | Quando usar |
|------------|-------------|
| `RadarPageShell` | Página tenant padrão (`max-w-[1600px]`, alinhado ao Inbox) |
| `PageHeader` | Título + subtítulo + ações |
| `MetricCard` | KPIs no topo |
| `FilterBar` | Filtros em linha |
| `LoadingState` / `EmptyState` / `ErrorState` | Estados de lista |
| `StatusBadge` | Badge semântico (success, warning, …) |
| `SectionCard` | Bloco com título |
| `DataTable` | Tabela simples |
| `InlineNotice` | Mensagens informativas, aviso de segredo, alerta leve e contexto de uso sem criar card extra |

Discord tenant: wrapper `DiscordPage`. Plataforma: `PlatformPage`.

---

## Helpers de formulário (`formClasses.ts`)

| Export | Descrição |
|--------|-----------|
| `inputCls`, `selectCls`, `textareaCls` | Campos nativos |
| `searchFieldIconCls` | Ícone Search dentro de `relative` |
| `waPreviewPanelCls`, `discordPreviewPanelCls` | Painéis de preview |
| `previewChannelLabelWaCls`, `previewChannelLabelDiscordCls` | Rótulos Discord → WA |
| `logLineMetaCls` | Acentos em linhas de log |

---

## Consentimento LGPD

`lib/consentUi.tsx` — badges/dots com tokens `--rz-warning/success/danger`. Bordas laterais usam `CONSENT_STATUS_META[].borderColor` (CSS vars).

---

## Regras para novas telas

1. Preferir `--rz-*` ou helpers do design system; evitar `gray-*`, hex solto ou cores Tailwind cruas.
2. **Exceções intencionais:** SVG de marcas (Google, Discord), paleta WA em status, acentos por categoria (ex.: `KIND_META` em Templates).
3. **Inbox chat:** manter layout fixo (`min-h-[70vh]`, painéis lista + conversa) — não converter para scroll de página.
4. Novos tokens visíveis → adicionar em `index.css`, espelhar em `tokens.ts` se usados em JS, documentar aqui.

---

## Layout v3 Fase 4 — base compartilhada

| Padrão | Uso |
|--------|-----|
| `InlineNotice` | Substitui textos soltos e cards pequenos de aviso em contextos de API/configuração. Tons: `info`, `success`, `warning`, `danger`, `neutral`. |
| `EmptyState size="sm"` | Estados vazios dentro de cards, tabs e painéis compactos. Mantém `md` como padrão para telas/listas. |
| `LoadingState label` | Nome acessível do carregamento por contexto, sem mudar skeleton visual. |
| `ErrorState` | Mantém erro real visível, mas redige padrões comuns de segredo (`token`, `secret`, `X-API-Key`, `rz_*`, `sk_*`, `whsec_*`). |
| `StatusBadge size="sm"` | Badges compactos em linhas de tabela/lista e cards densos. |
| `SectionCard compact` | Blocos internos menores sem criar novo padrão de card. |
| `DataTable ariaLabel` | Tabelas compartilhadas com nome acessível e overflow horizontal seguro. |

---

## Build

```bash
cd src/services/web-dashboard/frontend && npm run build
```
