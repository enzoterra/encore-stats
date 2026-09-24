# Encore

Estatísticas pessoais do Spotify com **privacidade por arquitetura**. Três modos:

- **Upload** (público): você envia o `.zip` do "Histórico estendido de streaming" e tudo é
  processado **no seu navegador**. O arquivo nunca sai do dispositivo.
- **Conectar** (até 5 contas na allowlist): login OAuth no Spotify; um BFF mínimo e sem estado
  guarda os tokens só num cookie JWE `HttpOnly`.
- **Demo**: dados fictícios e determinísticos, sem rede e sem login.

Stack: Next.js 16 (App Router, Turbopack) · React 19 · TypeScript 6 (`strict`) · Tailwind CSS 4 ·
next-intl (PT-BR e EN) · Zod 4 · Vitest 5 · Playwright + axe. Deploy na Vercel. Sem banco.
O plano completo está em [`docs/projeto/`](docs/projeto/).

> Estado: fundação, motor de upload/demo e **BFF do modo Conectar** prontos (Sprints 0–2). As
> telas entram nas próximas sprints; a página inicial e `/{idioma}/connect` são provisórias (veja
> `docs/projeto/PROGRESSO.md`). Contrato do BFF: [`docs/api.md`](docs/api.md).

## Pré-requisitos

| Ferramenta | Versão                        | Observação                                                                         |
| ---------- | ----------------------------- | ---------------------------------------------------------------------------------- |
| Node.js    | **24 LTS** (`.nvmrc`)         | O CI usa Node 24. Localmente, qualquer Node **≥ 22.12** funciona (`engines.node`). |
| pnpm       | **12.6.0** (`packageManager`) | Veja "Instalando o pnpm 12" abaixo.                                                |

### Instalando o pnpm 12

O caminho padrão é o Corepack (`corepack enable`). **Atenção:** o Corepack 0.34–0.36 ainda não
executa o pnpm 12 (procura `bin/pnpm.cjs`, que o pnpm 12 não publica mais) e falha com
`Cannot find module ...\pnpm\12.6.0\bin\pnpm.cjs` (`MODULE_NOT_FOUND`). Enquanto o Corepack não
for atualizado, use uma das alternativas:

```bash
# Opção A: instalação global via npm (desative o shim do Corepack para o pnpm não ser sombreado)
corepack disable pnpm
npm install -g pnpm@12.6.0

# Opção B: sem instalar nada globalmente
npx pnpm@12.6.0 install
```

Se o pnpm 12 terminar **sem nenhuma mensagem** (código de saída 21), confira o `~/.npmrc`: um
`cafile=` apontando para um arquivo que não existe faz o binário do pnpm abortar ao ler a
configuração. Corrija o caminho (ou remova a linha) e rode de novo.

Se um comando do pnpm ficar parado sem saída dentro do projeto, provavelmente há um processo
`pnpm` órfão (de uma execução interrompida) segurando a trava do store: encerre-o no Gerenciador
de Tarefas e rode de novo.

## Como rodar localmente

```bash
git clone <url-do-repositório> encore && cd encore
pnpm install
cp .env.example .env.local   # pode ficar vazio: Upload e Demo funcionam sem credenciais
pnpm dev                     # http://127.0.0.1:3000 (redireciona para /pt-BR ou /en)
```

Use **`http://127.0.0.1:3000`**, não `localhost`: o Spotify só aceita redirect URI de loopback
com IP literal, e o cookie de sessão depende da mesma origem.

O "seed" local é o **modo Demo** (gerador determinístico, sem banco e sem rede). Não há
credenciais de demonstração: o Demo não exige login.

### Telas do frontend

| Rota                   | O quê                                                                                 |
| ---------------------- | ------------------------------------------------------------------------------------- |
| `/{locale}`            | Landing: os 3 modos (Conectar desabilitado sem credenciais), selo de privacidade      |
| `/{locale}/onboarding` | Como pedir o histórico estendido ao Spotify + lembrete `.ics` gerado no navegador     |
| `/{locale}/upload`     | Envio do `.zip`/`.json` (Web Worker, nada sai do aparelho) e dashboard do histórico   |
| `/{locale}/demo`       | Dashboard com histórico fictício (aba "Visão Conectar" preenchida na Sprint 5)        |
| `/{locale}/privacy`    | Política de privacidade (LGPD): o que é tratado, onde, por quanto tempo, como revogar |
| `/{locale}/connect`    | Destino do login do Spotify (provisório até a Sprint 5)                               |

`{locale}` é `pt-BR` ou `en`; o idioma troca pelo menu do cabeçalho sem perder o histórico
carregado (o Dataset fica só na memória da aba; recarregar a página exige novo envio).

Para testar o upload sem o seu histórico real, use as fixtures sintéticas de `tests/fixtures/`
(`valid-two-files.zip`, ou os maliciosos `zip-bomb.zip` e `path-traversal.zip`).

Para rodar os testes E2E pela primeira vez, instale os navegadores do Playwright (Chromium e
WebKit, este último para aproximar o Safari/iOS):

```bash
pnpm exec playwright install chromium webkit
```

## Scripts

| Comando                             | O que faz                                                               |
| ----------------------------------- | ----------------------------------------------------------------------- |
| `pnpm dev`                          | Servidor de desenvolvimento em `127.0.0.1:3000`                         |
| `pnpm build` / `pnpm start`         | Build de produção / servidor de produção em `127.0.0.1:3000`            |
| `pnpm lint`                         | ESLint (flat config: Next + typescript-eslint), sem warnings            |
| `pnpm format` / `pnpm format:check` | Prettier (com ordenação de classes do Tailwind)                         |
| `pnpm typecheck`                    | Gera os tipos de rota do Next e roda `tsc --noEmit`                     |
| `pnpm test`                         | Vitest (unit/integração em Node e componentes em jsdom)                 |
| `pnpm test:coverage`                | Vitest com cobertura (meta ≥ 80% em `src/domain`)                       |
| `pnpm test:e2e`                     | Playwright (Chromium + WebKit) + axe; faz `build` + `start` se preciso  |
| `pnpm fixtures`                     | Regenera `tests/fixtures/` (zips sintéticos válidos e maliciosos)       |
| `pnpm bench`                        | Benchmark do upload: ~50 MB sintéticos (meta < 10 s) e troca de período |

## Variáveis de ambiente

Catálogo completo e comentado em [`.env.example`](.env.example); validação com Zod em
`src/server/env.ts`. Resumo:

| Variável                                                             | Obrigatória          | Para quê                                                     |
| -------------------------------------------------------------------- | -------------------- | ------------------------------------------------------------ |
| `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET`, `SPOTIFY_REDIRECT_URI` | Não (as três juntas) | Modo Conectar. Sem elas, o botão fica desabilitado           |
| `SESSION_SECRET`                                                     | Se houver Conectar   | 32 bytes em base64url para o cookie JWE                      |
| `SESSION_SECRET_PREVIOUS`                                            | Não                  | Rotação do segredo de sessão                                 |
| `NEXT_PUBLIC_SITE_URL`                                               | Em produção          | URL canônica (local: `http://127.0.0.1:3000`)                |
| `NEXT_PUBLIC_REPO_URL`                                               | Não                  | Link "veja o código" do selo de privacidade                  |
| `SPOTIFY_API_BASE`, `SPOTIFY_ACCOUNTS_BASE`                          | Não                  | Só testes: mock do Spotify em loopback (proibidas na Vercel) |

Configuração parcial do Spotify (ex.: só o Client ID) **falha na inicialização** com a lista das
variáveis que faltam. Nunca commite `.env.local` (já está no `.gitignore`).

Gerar um `SESSION_SECRET`:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

## Cadastrar o app no Spotify (modo Conectar)

1. Acesse o [Spotify Developer Dashboard](https://developer.spotify.com/dashboard) com a conta
   do **dono do app**. Desde 2025, apps em _Development Mode_ exigem que o dono tenha
   **Spotify Premium**.
2. **Create app**: nome "Encore", uma descrição curta, e marque **Web API**.
3. Em **Redirect URIs**, cadastre exatamente:
   - local: `http://127.0.0.1:3000/api/auth/callback`
   - staging e produção: `https://<domínio>/api/auth/callback` (na Sprint 8)
4. Copie o **Client ID** e o **Client Secret** para o `.env.local` (`SPOTIFY_CLIENT_ID`,
   `SPOTIFY_CLIENT_SECRET`), defina `SPOTIFY_REDIRECT_URI` com a URI local acima e gere o
   `SESSION_SECRET`.
5. Em **User Management**, adicione as contas que podem usar o Conectar: em _Development Mode_ o
   limite é de **5 usuários** (o autor + até 4), cada um com nome e e-mail da conta Spotify.
6. Reinicie o `pnpm dev`. A página inicial passa a mostrar o Conectar como disponível.

Escopos pedidos (mínimos): `user-top-read`, `user-read-recently-played`, `user-library-read`.

### Testar o login real em `http://127.0.0.1:3000`

1. Faça os passos acima (app no dashboard, redirect URI `http://127.0.0.1:3000/api/auth/callback`,
   sua conta em **User Management**) e preencha o `.env.local`:

   ```bash
   SPOTIFY_CLIENT_ID=<client id>
   SPOTIFY_CLIENT_SECRET=<client secret>
   SPOTIFY_REDIRECT_URI=http://127.0.0.1:3000/api/auth/callback
   SESSION_SECRET=<saída do comando node acima>
   ```

2. `pnpm dev` e abra **`http://127.0.0.1:3000/pt-BR/connect`** (use `127.0.0.1`, não
   `localhost`: os cookies vivem na origem da redirect URI; se abrir `localhost`, o login te leva
   para `127.0.0.1`).
3. Clique em **Entrar com o Spotify**, autorize e volte para a mesma página, que passa a dizer
   "Você está conectado ao Spotify".
4. Na mesma aba, abra as rotas do BFF para ver os dados reduzidos (JSON):
   `/api/spotify/me`, `/api/spotify/top?type=artists&range=short_term`,
   `/api/spotify/top?type=tracks&range=long_term`, `/api/spotify/recent`,
   `/api/spotify/saved?offset=0`.
5. Nas DevTools (Application → Cookies) o cookie `encore_session` é `HttpOnly` e `SameSite=Lax`,
   com validade de 30 dias. Localmente ele sai **sem** `Secure` e sem o prefixo `__Host-`, porque
   o Safari descarta cookies `Secure` em HTTP e o Chrome rejeita `__Host-` fora de HTTPS; em
   produção (HTTPS) o nome é `__Host-encore_session`, com `Secure` (detalhes em `docs/api.md`).
6. Clique em **Sair**: o cookie some e `/api/spotify/me` passa a responder
   `401 {"error":{"code":"UNAUTHENTICATED"}}`.

Casos para conferir: cancelar no Spotify volta com "Você cancelou a autorização"; uma conta fora
do User Management volta com a mensagem da lista de acesso (`?error=not_allowlisted`).

### Testar o fluxo sem conta do Spotify (mock local)

`scripts/spotify-mock-server.ts` simula o Accounts e a Web API com dados fictícios (confere o PKCE
e rotaciona o refresh token). Em dois terminais:

```bash
node scripts/spotify-mock-server.ts     # http://127.0.0.1:4010
```

No `.env.local` (credenciais quaisquer, porque o mock não as confere contra nada real):

```bash
SPOTIFY_CLIENT_ID=mock
SPOTIFY_CLIENT_SECRET=mock
SPOTIFY_REDIRECT_URI=http://127.0.0.1:3000/api/auth/callback
SESSION_SECRET=<32 bytes em base64url>
SPOTIFY_ACCOUNTS_BASE=http://127.0.0.1:4010
SPOTIFY_API_BASE=http://127.0.0.1:4010/v1
```

Depois `pnpm dev` (ou `pnpm build && pnpm start`) e siga os passos 2–6 acima. Apague as duas
linhas `SPOTIFY_*_BASE` para voltar ao Spotify real.

Variáveis do mock: `MOCK_SPOTIFY_DENY=1` (simula "cancelar"), `MOCK_SPOTIFY_FORBIDDEN=1` (conta
fora da allowlist), `MOCK_SPOTIFY_EXPIRES_IN=30` (força refresh a cada chamada).

## Estrutura

```
app/[locale]/        páginas (RSC) em /pt-BR e /en
app/api/             BFF (auth e proxy do Spotify) + /api/health
proxy.ts             nonce de CSP, cabeçalhos de segurança e negociação de idioma
src/domain/          lógica pura (histórico, Dataset, stats, demo), testável em Node
src/server/          env validado, cabeçalhos de segurança, sessão JWE, cliente Spotify, logger
src/features/        UI por área
src/workers/         Web Workers (processamento do upload)
src/i18n/            rotas e mensagens do next-intl
e2e/                 testes Playwright + axe
scripts/             fixtures (`pnpm fixtures`) e mock local do Spotify
tests/               setup, stubs, fixtures, mocks do Spotify e benchmark (`tests/perf`)
docs/api.md          contrato do BFF (rotas, parâmetros, erros, TTLs, OAuth)
```

Alias de import: `@/…` aponta para `src/…`.

## Segurança e CI

- Cabeçalhos em toda resposta (HSTS, `nosniff`, `Referrer-Policy: no-referrer`,
  `Permissions-Policy`, COOP) e, nas páginas, CSP com nonce por requisição (`strict-dynamic`,
  `frame-ancestors 'none'`).
  Confira com `curl -I http://127.0.0.1:3000/pt-BR`.
- GitHub Actions (`.github/workflows/ci.yml`), com `permissions: contents: read` e actions
  fixadas por SHA: lint + formatação, tipos, testes com cobertura, build, e2e + axe (Chromium,
  sem credenciais), `pnpm audit --audit-level=high` e dependency-review nos PRs.
- Dependabot semanal e agrupado (npm e GitHub Actions), com espera de 3 dias.
- pnpm: scripts de install bloqueados (`allowBuilds`) e `minimumReleaseAge` de 1 dia em
  `pnpm-workspace.yaml`.
