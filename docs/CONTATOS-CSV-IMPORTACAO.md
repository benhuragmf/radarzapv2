# Contatos — importação e exportação CSV

**Última atualização:** junho/2026  
**Escopo:** Fase 3 da Plataforma (`/platform/contacts`), API `POST /api/destinations/import-csv`, export CSV/VCF.

---

## 1. Objetivo

Permitir que o cliente traga contatos de **Google Contacts / Android**, **Apple Contacts / iOS** (ou exportações compatíveis) e de planilhas genéricas, normalizando para o modelo canônico do RadarZap e exportando de volta em perfis compatíveis com cada ecossistema.

**Estado do código (jun/2026):** `POST /api/destinations/import-csv` (JSON `{ content | csv, format?: 'auto'|'csv'|'vcf', dryRun }`); detecção automática de VCF (`BEGIN:VCARD`); `GET /api/destinations/export-csv?profile=...` com BOM UTF-8; parsers em `contact-csv-import.ts` / `contact-vcf-import.ts`. Upload **`multipart`** — backlog (não bloqueia gate Fase 1); ver [`PENDENCIAS-HUMANAS-FASE1.md`](./PENDENCIAS-HUMANAS-FASE1.md).

---

## 2. Busca por CSV de exemplo no repositório

| Local | Resultado |
|-------|-----------|
| `radarzapv2/**/*.csv` | Nenhum arquivo |
| `radarzap/**/*.csv` | Nenhum arquivo |
| `docs/samples/Contatos-exemplo.vcf` | 20 vCards (amostra sanitizada de export iOS/Android) |
| `assets/` | Inexistente |
| Área de trabalho / Projetos / Downloads (contatos) | Nenhum CSV de contatos encontrado |

Se você tiver um `.csv` de exemplo (export Google ou Apple), coloque em `docs/samples/contatos-exemplo.csv` e atualize a §8 deste doc com a tabela de mapeamento **a partir do cabeçalho real**.

Até lá, os mapeamentos abaixo seguem os formatos **oficiais / de mercado** documentados pelo Google Contacts e exportações CSV comuns do ecossistema Apple.

---

## 3. Modelo canônico RadarZap

Campos internos (API, Mongo, export nativo). Nomes em português na UI; chaves em inglês no CSV nativo.

| Campo canônico | Chave CSV nativa | Obrigatório | Tipo / regras |
|----------------|------------------|-------------|---------------|
| Nome | `nome` | Sim | 1–100 caracteres; trim |
| Telefone | `telefone` | Sim | E.164 preferido; ver §5 |
| Aniversário | `aniversario` | Não | Data normalizada `YYYY-MM-DD` |
| Grupos | `grupos` | Não | Lista separada por `;` → `tags[]` (Fase 3) |
| E-mail | `email` | Não | Opcional, validação RFC básica |
| Notas | `notas` | Não | Texto livre, máx. 2000 chars (sugestão) |

**Aliases aceitos no import** (mesma linha que o roadmap): `name`↔`nome`, `phone`↔`telefone`, `birthday`↔`aniversario`, `groups`↔`grupos`, `tags`↔`grupos`, `notes`↔`notas`.

**Destino WhatsApp:** cada linha válida vira `type: 'contact'`, `identifier` = telefone normalizado, `name` = nome, mais metadados quando o schema existir.

---

## 4. Perfis de arquivo (detecção automática)

O parser deve identificar o perfil pelo **conjunto de cabeçalhos** (case-insensitive, trim, BOM UTF-8 removido).

| Perfil | ID interno | Fingerprint (qualquer coluna da lista) |
|--------|------------|----------------------------------------|
| Google Contacts / Android | `google` | `Phone 1 - Value` ou `Group Membership` + (`Given Name` ou `Name`) |
| Apple Contacts / iOS CSV | `apple` | `First Name` + (`Mobile Phone` ou `Home Phone` ou `Phone`) sem `Phone 1 - Value` |
| RadarZap nativo | `radarzap` | `nome` + `telefone` (ou `name` + `phone`) |
| Genérico | `generic` | Cabeçalho mínimo: coluna de nome + coluna de telefone mapeável (§4.3) |

Ordem de tentativa: `radarzap` → `google` → `apple` → `generic`.

### 4.1 Google Contacts / Android (export CSV)

Export: [Google Contacts](https://contacts.google.com) → **Exportar** → **Google CSV**.

Cabeçalhos relevantes (export completo Google; dezenas de colunas — só estas entram no mapeamento):

| Coluna Google | → Campo RadarZap | Regra |
|---------------|------------------|-------|
| `Name` | `nome` | Preferir se preenchido |
| `Given Name` + `Family Name` | `nome` | Se `Name` vazio: `Given Name` + espaço + `Family Name` |
| `Phone 1 - Value` … `Phone 4 - Value` | `telefone` | Primeiro valor não vazio; priorizar tipo **Mobile** / **Celular** se houver coluna `Phone N - Type` |
| `Birthday` | `aniversario` | Ver §6 |
| `Group Membership` | `grupos` | Ver §7 |
| `E-mail 1 - Value` … | `email` | Primeiro e-mail não vazio |
| `Notes` | `notas` | Texto direto |

Colunas ignoradas no import: endereços, organização, relações, fotos, campos Yomi, etc.

**Exemplo de cabeçalho (primeira linha típica Google — truncado):**

```text
Name,Given Name,Family Name,...,Birthday,...,Group Membership,...,Notes,...,Phone 1 - Type,Phone 1 - Value,Phone 2 - Type,Phone 2 - Value,...,E-mail 1 - Type,E-mail 1 - Value,...
```

### 4.2 Apple Contacts / iOS (CSV)

No iPhone/iPad o export nativo costuma ser **vCard (`.vcf`)**, não CSV. Usuários que chegam com CSV em geral usam:

- app de terceiros, ou  
- exportação do app **Contatos** no Mac (versões que geram CSV), ou  
- conversão manual de vCard → CSV.

Cabeçalhos comuns e mapeamento:

| Coluna Apple (variantes) | → Campo RadarZap | Regra |
|--------------------------|------------------|-------|
| `First Name` + `Last Name` | `nome` | Concatenar com espaço; ou `Full Name` / `Name` se existir |
| `Middle Name` | (opcional) | Inserir entre primeiro e último se presente |
| `Mobile Phone` | `telefone` | Prioridade 1 |
| `iPhone` | `telefone` | Prioridade 1 (alias) |
| `Home Phone`, `Work Phone`, `Phone` | `telefone` | Prioridade 2, 3, 4 — primeiro não vazio |
| `Birthday` | `aniversario` | Ver §6 |
| `Email Address`, `Email`, `E-mail` | `email` | Primeiro não vazio |
| `Notes` | `notas` | Texto direto |
| `Groups`, `Group`, `Category` | `grupos` | Ver §7 |

**Import vCard:** ver §16 — parser `contact-vcf-import.ts` (`FN`, `N`, `TEL`, `BDAY`, `EMAIL`, `NOTE`, `CATEGORIES`, `ORG` → `organization`).

### 4.3 Genérico / outras listas

| Origem típica | Colunas comuns | Mapeamento sugerido |
|---------------|-----------------|---------------------|
| Excel manual | `Nome`, `Telefone`, `Aniversário` | Aliases PT → canônico |
| Outlook CSV | `First Name`, `Last Name`, `Mobile Phone`, `E-mail Address` | Perfil `apple`-like |
| HubSpot / CRM | `firstname`, `lastname`, `phone`, `email` | `generic` + mapa configurável (futuro) |

Cabeçalho mínimo aceito: **uma coluna de nome** + **uma coluna de telefone** (qualquer alias da §3).

---

## 5. Normalização de telefone (Brasil e internacional)

Reutilizar `src/utils/whatsapp-phone.ts`:

1. Remover espaços, `(`, `)`, `-`, `.`.
2. Se começar com `0` (trunk BR), remover zeros à esquerda após DDD.
3. Se 10–11 dígitos sem DDI → prefixar `55`.
4. Aplicar `normalizeBrazilPhoneDigits` quando DDI `55`: máximo 13 dígitos (`55` + DDD + 9 + 8 dígitos).
5. Persistir `identifier` como `+{digits}` (E.164 sem espaços).
6. **Dedupe:** chave única `(organizationId | clientId, identifier normalizado)`; variantes BR com/sem 9º dígito devem resolver para o mesmo contato via `brazilPhoneLookupVariants` antes de criar duplicata.

| Entrada exemplo | Saída |
|-----------------|--------|
| `(11) 97690-4921` | `+5511976904921` |
| `11976904921` | `+5511976904921` |
| `+55 11 97690-4921` | `+5511976904921` |
| `5511976904921` | `+5511976904921` |

Linhas sem telefone válido após normalização → **erro** na linha (não importar).

---

## 6. Aniversário (`aniversario`)

Ordem de parse:

| Formato de entrada | Exemplo | Saída |
|--------------------|---------|-------|
| ISO | `1990-05-15` | `1990-05-15` |
| BR | `15/05/1990` | `1990-05-15` |
| BR curto | `15/05` | `0000-05-15` ou guardar `MM-DD` apenas (definir na UI; padrão: ano `0000` = “sem ano”) |
| Google sem ano | `--05-15` | `0000-05-15` |
| Apple / US | `May 15, 1990` | `1990-05-15` |

Campo ausente ou inválido → `aniversario` omitido (não falha a linha).

---

## 7. Grupos (`grupos`)

| Fonte | Formato bruto | Parse |
|-------|---------------|-------|
| RadarZap / genérico | `VIP; Clientes; Aniversário` | `split(';')`, trim, descartar vazios |
| Google `Group Membership` | `My Contacts ::: * starred ::: VIP` | Extrair rótulos após `:::`; ignorar `* myContacts`, `* starred`, `* friends`, etc. |
| Apple `Groups` | `Família, Trabalho` | `split` por `,` ou `;` conforme detecção |

Persistência alvo: `tags: string[]` no destino ou entidade `ContactGroup` (Fase 3). Grupos desconhecidos → criar tag ou ignorar (configurável; padrão: **criar tag**).

---

## 8. Tabela de mapeamento (referência Google — sem arquivo exemplo no repo)

Como **não há CSV de exemplo versionado**, a tabela abaixo reflete um export **Google CSV padrão** (jun/2026). Quando `docs/samples/contatos-exemplo.csv` existir, substituir por leitura automática do cabeçalho.

| # | Cabeçalho no arquivo (Google) | Campo RadarZap | Observação |
|---|------------------------------|----------------|------------|
| 1 | `Name` | `nome` | Display name |
| 2 | `Given Name` | `nome` | Fallback composição |
| 3 | `Family Name` | `nome` | Fallback composição |
| 4 | `Phone 1 - Value` | `telefone` | Primário |
| 5 | `Phone 2 - Value` | `telefone` | Se 1 vazio |
| 6 | `Birthday` | `aniversario` | §6 |
| 7 | `Group Membership` | `grupos` | §7 |
| 8 | `E-mail 1 - Value` | `email` | Opcional |
| 9 | `Notes` | `notas` | Opcional |

---

## 9. Fluxo de importação

```mermaid
flowchart LR
  A[Upload CSV] --> B[Detectar encoding UTF-8/BOM]
  B --> C[Detectar perfil]
  C --> D[Mapear colunas]
  D --> E[Por linha: normalizar tel]
  E --> F[Dedupe org+phone]
  F --> G[Upsert Destination]
  G --> H[Relatório JSON]
```

1. **Validar cabeçalho** — mínimo nome + telefone mapeáveis.
2. **Limite** — ex.: 5 000 linhas por upload (rate limit no roadmap).
3. **Por linha:** normalizar → buscar destino existente → `update` ou `create` com `consentSource: 'import'`.
4. **Relatório:** `{ criados, atualizados, ignorados, erros: [{ linha, motivo }] }`.
5. **UI:** `/platform/contacts` — preview 5 primeiras linhas + mapeamento detectado antes de confirmar.

API atual (`bulkImport`): body JSON pré-parsed; etapa futura `POST .../bulk-import/csv` com `multipart/form-data`.

---

## 10. Perfis de exportação

| Perfil | ID | Uso | Colunas emitidas |
|--------|-----|-----|------------------|
| RadarZap nativo | `radarzap-native` | Backup, reimportação | `nome`, `telefone`, `aniversario`, `grupos`, `email`, `notas`, `status_consent` (opcional) |
| Google-compatível | `google-compatible` | Reimport no Google/Android | `Name`, `Given Name`, `Family Name`, `Phone 1 - Type`, `Phone 1 - Value`, `Birthday`, `Group Membership`, `E-mail 1 - Value`, `Notes` |
| Apple-compatível | `apple-compatible` | Reimport em apps Apple / CSV | `First Name`, `Last Name`, `Mobile Phone`, `Birthday`, `Email Address`, `Notes`, `Groups` |

Regras de export:

- UTF-8 com **BOM** (`EF BB BF`) para Excel abrir acentos corretamente.
- `telefone` sempre em E.164 (`+55...`).
- `aniversario` em export Google: `YYYY-MM-DD` ou `--MM-DD` se sem ano.
- `grupos` RadarZap → Google: `Label ::: * myContacts` ou lista separada por ` ::: ` conforme doc Google.
- `status_consent`: somente perfil nativo (`granted` / `pending` / `revoked`).

Endpoint planejado: `GET /api/destinations/client/:clientId/export?format=csv&profile=google-compatible` (hoje `exportDestinationData` retorna nome de arquivo — implementação pendente).

---

## 11. Exemplo mínimo — CSV RadarZap nativo

```csv
nome,telefone,aniversario,grupos,email,notas
Maria Silva,+5511988776655,1992-03-20,VIP; Clientes,maria@exemplo.com,Cliente desde 2024
João Santos,5511976904921,15/08,,,Sem email
```

---

## 12. Exemplo mínimo — trecho Google (1 contato)

```csv
Name,Given Name,Family Name,Birthday,Group Membership,Notes,Phone 1 - Type,Phone 1 - Value,E-mail 1 - Value
Maria Silva,Maria,Silva,1992-03-20,VIP ::: * myContacts,,Mobile,+55 11 98877-6655,maria@exemplo.com
```

---

## 13. Exemplo mínimo — trecho Apple

```csv
First Name,Last Name,Mobile Phone,Birthday,Email Address,Notes,Groups
Maria,Silva,+55 11 98877-6655,3/20/1992,maria@exemplo.com,,VIP
```

---

## 14. Arquivos de implementação (alvo)

| Arquivo | Responsabilidade |
|---------|------------------|
| `src/utils/contact-csv-import.ts` | Detecção de perfil CSV, mapeamento, parse linhas |
| `src/utils/contact-vcf-import.ts` | Parse vCard 2.1/3.0/4.0, quoted-printable |
| `src/constants/contact-csv-formats.ts` | Aliases e fingerprints por perfil |
| `src/services/destinations/contactCsvImportService.ts` | Upsert Mongo após parse |
| `src/utils/contact-csv-export.ts` | Perfis §10 (implementado) |
| `src/services/destinations/contactCsvExportService.ts` | Busca destinos + gera CSV |
| `src/utils/whatsapp-phone.ts` | Normalização BR (existente) |
| `src/services/destinations/DestinationController.ts` | `bulkImport`, export CSV |
| `src/models/Destination.ts` | Campos `birthday`, `email`, `notes`, `tags` (migração) |
| `frontend/.../PlatformContacts.tsx` | UI import/export |

---

## 15. Critérios de aceite (testes)

- [ ] Import Google CSV real (≥10 contatos) → 100% telefones `+55...` válidos
- [ ] Import Apple CSV → nomes compostos corretos
- [ ] Reimportar export `radarzap-native` → idempotente (só atualiza)
- [ ] Duplicata mesma planilha → 0 novos, N atualizados
- [ ] Linha sem telefone → aparece em `erros` com número da linha
- [ ] Export `google-compatible` abre no Google Contacts sem perda de colunas obrigatórias

---

## 16. Importação vCard (`.vcf`)

Export nativo **Apple Contacts / iOS** e muitos apps Android (via “Compartilhar contatos” ou backup). Amostra versionada: `docs/samples/Contatos-exemplo.vcf` (20 de 1000 vCards do arquivo real `Contatos.vcf`).

### 16.1 Análise do arquivo de exemplo (usuário)

| Métrica | Valor |
|---------|--------|
| Total de vCards | **1000** |
| Versão predominante | **2.1** (não 3.0/4.0) |
| Campos presentes no arquivo real | `VERSION`, `N`, `FN`, `TEL`, `ORG` |
| Campos ausentes no arquivo real | `BDAY`, `EMAIL`, `NOTE`, `CATEGORIES` (suportados pelo parser quando existirem) |
| Codificação | `CHARSET=UTF-8` + `ENCODING=QUOTED-PRINTABLE` em vários `N`/`FN`/`ORG` |
| Telefones | `TEL;CELL`, `TEL;HOME`, `TEL;CELL;PREF`, `TEL;X-WhatsApp` |

### 16.2 Mapeamento vCard → RadarZap

| # | Propriedade vCard (exemplo real) | Campo RadarZap | Regra |
|---|----------------------------------|----------------|-------|
| 1 | `FN` (Formatted Name) | `nome` | Preferencial; QP decodificado |
| 2 | `N` (Structured Name) | `nome` | Fallback: Given + Middle + Family |
| 3 | `TEL;CELL`, `TEL;HOME`, `TEL;X-WhatsApp`, `PREF` | `telefone` + `phoneType` | Prioridade: WhatsApp/cell/mobile > PREF > home; tipo derivado do `TYPE` |
| 3b | 2º `TEL` com número E.164 distinto | `secondaryPhone` | Segunda linha válida após o principal |
| 4 | `BDAY` | `aniversario` | `YYYYMMDD` ou ISO → §6 |
| 5 | `CATEGORIES` | `grupos` | Split `,` ou `;` |
| 6 | `EMAIL` | `email` | Primeiro / `PREF` |
| 7 | `NOTE` | `notas` | Texto livre |
| 8 | `ORG` | `organization` | Empresa / organização (coluna **Empresa** na UI) |

### 16.3 API e UI

- **Endpoint:** `POST /api/destinations/import-csv` (mesmo do CSV).
- **Body:** `{ "content": "<texto do arquivo>", "format": "auto" | "csv" | "vcf", "dryRun": true|false }` — `csv` legado ainda aceito como alias de `content`.
- **Resposta:** `{ format, profile, preview, totalLinhasDados, report }` — para VCF, `profile` = `vcf` e `totalLinhasDados` = número de vCards.
- **UI:** `/platform/contacts` — aceita `.vcf` e `.csv`; exibe formato detectado.

### 16.4 Limitações conhecidas

- Limite **5000** vCards por upload (igual CSV).
- **Foto** (`PHOTO`) ignorada.
- Múltiplos `TEL`: importa o principal (maior prioridade) + **um** secundário se o E.164 for diferente e válido.
- vCards **sem `FN` nem `N` utilizável** ou **sem telefone válido** → erro por índice de vCard.
- Arquivo do usuário sem aniversário/e-mail: esses campos ficam vazios até o contato ser editado no RadarZap ou reexportado com mais dados.

### 16.5 Como testar com o arquivo em Downloads

1. Subir backend + frontend do painel.
2. Abrir **Plataforma → Contatos**.
3. **Escolher CSV ou VCF** → selecionar `C:\Users\benhu\Downloads\Contatos.vcf`.
4. Conferir preview (formato `vcf`, ~1000 contatos, perfil `vcf`).
5. **Confirmar importação** (ou `dryRun` via API para só preview).

```bash
# Preview via API (substitua TOKEN e cole o arquivo em content)
curl -X POST http://localhost:3001/api/destinations/import-csv \
  -H "Content-Type: application/json" \
  -H "Cookie: radarzap.sid=..." \
  -d "{\"content\":\"BEGIN:VCARD...\",\"format\":\"vcf\",\"dryRun\":true}"
```

---

## Histórico

- **jun/2026:** Import vCard (`contact-vcf-import.ts`), amostra `docs/samples/Contatos-exemplo.vcf`, API `format` auto/csv/vcf.
- **jun/2026:** Documento criado; mapeamentos CSV baseados em formatos Google/Apple padrão e roadmap §6.
