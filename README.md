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

> Estado: **Sprint 0 (fundação)**. A página inicial é provisória; as funcionalidades entram nas
> próximas sprints (veja `docs/projeto/PROGRESSO.md`).

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

O "seed" local é o **modo Demo** (gerador determinístico, sem banco e sem rede), que chega na
Sprint 1/4. Não há credenciais de demonstração: o Demo não exige login.

Para rodar os testes E2E pela primeira vez, instale o Chromium do Playwright:

```bash
pnpm exec playwright install chromium
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
| `pnpm test:e2e`                     | Playwright + axe (faz `build` + `start` se não houver servidor rodando) |
| `pnpm fixtures`                     | Regenera `tests/fixtures/` (zips sintéticos válidos e maliciosos)       |
| `pnpm bench`                        | Benchmark do upload: ~50 MB sintéticos (meta < 10 s) e troca de período |

## Variáveis de ambiente

Catálogo completo e comentado em [`.env.example`](.env.example); validação com Zod em
`src/server/env.ts`. Resumo:

| Variável                                                             | Obrigatória          | Para quê                                           |
| -------------------------------------------------------------------- | -------------------- | -------------------------------------------------- |
| `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET`, `SPOTIFY_REDIRECT_URI` | Não (as três juntas) | Modo Conectar. Sem elas, o botão fica desabilitado |
| `SESSION_SECRET`                                                     | Se houver Conectar   | 32 bytes em base64url para o cookie JWE            |
| `SESSION_SECRET_PREVIOUS`                                            | Não                  | Rotação do segredo de sessão                       |
| `NEXT_PUBLIC_SITE_URL`                                               | Em produção          | URL canônica (local: `http://127.0.0.1:3000`)      |
| `NEXT_PUBLIC_REPO_URL`                                               | Não                  | Link "veja o código" do selo de privacidade        |

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
O login em si chega na Sprint 2.

## Estrutura

```
app/[locale]/        páginas (RSC) em /pt-BR e /en
app/api/             BFF (auth e proxy do Spotify) + /api/health
proxy.ts             nonce de CSP, cabeçalhos de segurança e negociação de idioma
src/domain/          lógica pura (histórico, Dataset, stats, demo), testável em Node
src/server/          env validado, cabeçalhos de segurança, sessão e cliente Spotify
src/features/        UI por área
src/workers/         Web Workers (processamento do upload)
src/i18n/            rotas e mensagens do next-intl
e2e/                 testes Playwright + axe
scripts/             geração das fixtures (`pnpm fixtures`)
tests/               setup, stubs, fixtures e benchmark (`tests/perf`)
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
