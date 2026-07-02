# Painel — Salvar configuração e feedback (padrão)

**Referência visual:** `/platform/inbox/ia` (IA de Atendimento)  
**Versão:** 2.12.29 · **Atualizado:** 2026-06-27

---

## Objetivo

Formulários de **configuração persistente** no painel usam o mesmo rodapé de save e o mesmo toast de sucesso — evitando barras duplicadas, texto inline “Salvo!” e `toast.success` avulso.

---

## Componentes

| Peça | Onde | Uso |
|------|------|-----|
| **`ConfigSaveFooter`** | `@/design-system` | Botão `Salvar configurações` sticky inferior direito, ícone Save, `shadow-lg` |
| **`notifyConfigSaved()`** | `@/lib/notify` | Toast Sonner **“Configurações salvas”** (canto inferior direito) |
| **`mutationError()`** | `@/lib/notify` | Erros de API no save (dedupe offline, humanização) |
| **`SaveBar`** | `@/design-system` | Alias de `ConfigSaveFooter` — não usar `hint`/`onCancel` legados |

### Toaster global

Configurado em `frontend/src/main.tsx`:

```tsx
<Toaster richColors closeButton position="bottom-right" visibleToasts={2} />
```

---

## Padrão de implementação

```tsx
import { ConfigSaveFooter } from '@/design-system'
import { notifyConfigSaved, mutationError } from '@/lib/notify'

const save = useMutation({
  mutationFn: (body) => api.patch('/…', body),
  onSuccess: () => {
    qc.invalidateQueries({ queryKey: ['…'] })
    notifyConfigSaved()
  },
  onError: mutationError,
})

// JSX — uma única vez, após o conteúdo do formulário
<ConfigSaveFooter onSave={() => save.mutate(form)} saving={save.isPending} />
```

### Regras

1. **Um botão de save por página** (ou por editor com estado isolado, ex. widget WebChat só quando `isDirty`).
2. **Sem feedback inline** no rodapé (`setSaved`, “Salvo!” no botão) — sucesso vai para Sonner.
3. **Erros** sempre via `mutationError`, nunca `alert()` ou `toast` direto salvo exceção documentada.
4. **Abas só leitura** (logs, testar): `hidden` no footer ou não renderizar.
5. **Ações pontuais** (criar widget, copiar embed, excluir) mantêm mensagem específica com `notifySuccess('…')`.

---

## Páginas já padronizadas (Atendimento)

| Rota | Página |
|------|--------|
| `/platform/inbox/ia` | IA de Atendimento |
| `/platform/inbox/bot` | Triagem e Bot |
| `/platform/inbox/respostas` | Respostas rápidas |
| `/platform/webchat` | Chat do Site (editor widget + toasts de config) |
| `/platform/wa-limits` | Limites de envio WhatsApp (tenant) |
| `/admin/settings` | Política global WA (admin) |

---

## Exceções intencionais

| Caso | Motivo |
|------|--------|
| Save inline em **card de criar/editar** (setor, regra, ticket) | Ação local do item, não “salvar página inteira” |
| `WebChatWidgetSaveBar` | Só aparece com alterações não salvas (`isDirty`) |
| Mensagens específicas | “Widget criado”, “Embed copiado”, etc. |

---

## Migração de páginas legadas

1. Remover `setSaved` / texto no botão.
2. Trocar `toast.success` / `toast.error` por `notifyConfigSaved` / `mutationError`.
3. Substituir barra full-width ou botão no meio do form por `ConfigSaveFooter` no final.
4. Validar visualmente com IA de Atendimento como referência.

---

## Arquivos-chave

- `frontend/src/design-system/components/ConfigSaveFooter.tsx`
- `frontend/src/lib/notify.ts` — `CONFIG_SAVED_MESSAGE`, `notifyConfigSaved`
- `frontend/src/design-system/toast.ts` — wrappers Sonner
