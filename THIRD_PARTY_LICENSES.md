# Licenças de terceiros — Radar Chat / RadarGamer

O Radar Chat é **software proprietário**. Este arquivo lista bibliotecas de código
aberto usadas no projeto e cujos avisos de copyright devem ser preservados na
distribuição do software compilado ou empacotado.

Consulte `node_modules/<pacote>/LICENSE` para o texto integral de cada licença.

---

## Backend (`package.json`)

| Pacote | Licença típica | Uso |
|--------|----------------|-----|
| `@whiskeysockets/baileys` | MIT | WhatsApp Web |
| `discord.js` | Apache-2.0 | Bot Discord |
| `@discordjs/builders`, `@discordjs/rest` | Apache-2.0 | Comandos Discord |
| `bullmq` | MIT | Filas |
| `ioredis` | MIT | Redis |
| `express` | MIT | HTTP API |
| `mongoose` | MIT | MongoDB ODM |
| `mongodb` | Apache-2.0 | Driver MongoDB |
| `socket.io` | MIT | WebSocket painel |
| `jsonwebtoken` | MIT | Tokens |
| `express-session`, `connect-redis` | MIT | Sessão |
| `helmet`, `cors` | MIT | Segurança HTTP |
| `joi` | BSD-3-Clause | Validação |
| `pino`, `winston` | MIT | Logs |
| `qrcode` | MIT | QR WhatsApp |
| `uuid` | MIT | IDs |
| `dotenv` | BSD-2-Clause | Variáveis de ambiente |

## Frontend (`src/services/web-dashboard/frontend`)

| Pacote | Licença típica | Uso |
|--------|----------------|-----|
| `react`, `react-dom` | MIT | UI |
| `react-router-dom` | MIT | Rotas |
| `@tanstack/react-query` | MIT | Dados |
| `recharts` | MIT | Gráficos |
| `lucide-react` | ISC | Ícones |
| `socket.io-client` | MIT | Tempo real |
| `vite` | MIT | Build (dev) |
| `tailwindcss` | MIT | Estilos (dev) |

---

## MIT (resumo)

Permite uso, cópia, modificação, distribuição, sublicenciamento e venda, desde
que o aviso de copyright e a permissão sejam mantidos nas cópias ou partes
substanciais do software.  
Referência: [Open Source Initiative — MIT](https://opensource.org/license/mit)

## Apache-2.0 (resumo)

Permite uso comercial e modificação, com preservação de avisos, licença e
patentes aplicáveis.  
Referência: [Apache License 2.0](https://www.apache.org/licenses/LICENSE-2.0)

---

## Dependências a evitar sem revisão jurídica

Não adicionar dependências **GPL** ou **AGPL** ao core do Radar Chat sem análise
prévia — podem impor obrigações de abertura de código em certos cenários de
distribuição ou SaaS.

---

*Atualize este arquivo ao incluir novas dependências relevantes em produção.*
