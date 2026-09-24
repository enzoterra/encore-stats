# Progresso — Encore

## Estado atual
- Perfil: padrão-leve (web fullstack leve, sem banco, sem Docker, sem IA, Vercel)
- Fase: 3 — Implementação (plano aprovado pelo cliente em 2026-09-24; commit 4c4d5a8 em main)
- Sprint em andamento: nenhuma. Sprint 1 ✅ concluída (dev-backend, 2026-09-24; aguarda commit do orquestrador)
- Próximo passo ao retomar: Sprint 2 (dev-backend, BFF) e/ou Sprint 4 (dev-frontend), que já pode consumir `src/domain` e o worker
- Sprint 3 (designer): ✅ **design aprovado pelo cliente em 2026-09-24** (commit df9610c). Liberado para a Sprint 4 após a Sprint 1
- Commits: o orquestrador faz 1 commit por sprint em main, **sem menção a IA/Claude** (pedido do cliente); subagentes não commitam
- Última atualização: 2026-09-24 por dev-backend (fim da Sprint 1)

## Fases
- [x] Fase 0: preparação (repositório greenfield; `docs/projeto/` criado)
- [x] Fase 1: descoberta (`00-descoberta.md`, aprovada pelo cliente)
- [x] Fase 2: planejamento (`01`–`03`, `05`–`09`, `PADROES.md`); aprovado
- [ ] Fase 3: implementação (🔄)
- [ ] Fase 4: validação e UAT

## Decisões registradas
- 2026-09-24:
  - Três modos: Upload (público), Conectar (allowlist ≤ 5), Demo.
  - Cards como imagem baixável.
  - PT-BR + EN.
  - Deploy na Vercel.
- 2026-09-24:
  - Arquitetura Next.js + BFF (tokens em cookie JWE).
  - Visual "Palco Neon".
  - Nome **Encore**.
  - Métricas "você por você": fã desde, % dos plays, dias diferentes, mais pulada, dia mais musical.

## Sprints
### Sprint 0 — Fundação — ✅ concluída (2026-09-24) · analista-de-infra
- [x] S0.1 App Next 16.3.x + TS 6 strict + Tailwind 4 + pnpm 12 + `.nvmrc` 24
- [x] S0.2 Estrutura de pastas e aliases
- [x] S0.3 ESLint/Prettier e scripts
- [x] S0.4 next-intl `/pt-BR` e `/en`
- [x] S0.5 `proxy.ts` com CSP nonce e cabeçalhos
- [x] S0.6 `.env.example` e `env.ts` com Zod; flag de Conectar desabilitado
- [x] S0.7 Vitest, Testing Library, Playwright e axe
- [x] S0.8 GitHub Actions + Dependabot + pnpm `minimumReleaseAge`
- [x] S0.9 README "como rodar"
- Versões instaladas: next 16.3.6, react 19.3.0, typescript 6.0.3, tailwindcss 4.3.3, **next-intl 4.14.6** (a 4.14.7 saiu hoje e é barrada pelo `minimumReleaseAge: 1440`; o Dependabot sobe depois), zod 4.6.5, vitest 5.0.1, @playwright/test 1.63.0, @axe-core/playwright 4.13.0, eslint 10.11.0, typescript-eslint 8.70.1, eslint-config-next 16.3.6, @types/node 24.x
- Como verificar: `pnpm i` → `pnpm lint && pnpm format:check && pnpm typecheck && pnpm test && pnpm build` → `pnpm exec playwright install chromium && pnpm test:e2e` (7 testes, inclui axe e CSP) → `pnpm dev` e `curl -I http://127.0.0.1:3000/pt-BR` (CSP com nonce, HSTS, nosniff, Referrer-Policy, Permissions-Policy, COOP). `/` redireciona para `/pt-BR` ou `/en` pelo Accept-Language. `GET /api/health` → `{"status":"ok"}`
- Notas de ambiente: Node local 22.20 (o `engines.node` aceita ≥ 22.12; `.nvmrc` e CI usam 24). O Corepack 0.34–0.36 não roda o pnpm 12 (procura `bin/pnpm.cjs`); alternativas no README (`npm i -g pnpm@12.6.0` ou `npx pnpm@12.6.0`). A config npm global da máquina usa registry `http://`; o `pnpm audit` local só funciona com `--registry=https://registry.npmjs.org/` (no CI não há esse problema)
- Decisões de infra: `app/` na raiz + `src/` para o resto (alias `@/*` → `src/*`); ESLint 10 exige `settings.react.version` explícito (eslint-plugin-react 7.x quebra na detecção automática; peers de react/import/jsx-a11y ainda declaram até ESLint 9, sem erro prático); `allowBuilds` nega scripts de `@parcel/watcher`, `@swc/core` e `unrs-resolver` (binários pré-compilados); `agentRules: false` no `next.config.ts` (o `next dev` 16.3 gerava AGENTS.md/CLAUDE.md na raiz); `upgrade-insecure-requests` só em HTTPS; em dev a CSP adiciona `'unsafe-eval'` e `style-src 'unsafe-inline'` (overlay do Next); `X-Frame-Options: DENY` como reforço legado
- Pendências para os próximos papéis: dev-backend (S1) cria `src/domain/**` (o limiar de 80% já está no `vitest.config.ts`) e o script `pnpm fixtures`; S2 adiciona `jose`, `logger.ts` e, se quiser mock da API nos e2e, `SPOTIFY_API_BASE` no `env.ts` (bloqueada em produção); S4 adiciona WebKit ao Playwright e move as fontes para `public/fonts`; S7 valida `'wasm-unsafe-eval'` só na rota de cards, liga CodeQL (default setup) e confirma se o Dependabot lê o lockfile do pnpm 12 (tem 2 documentos YAML por causa de `packageManagerDependencies`); branch protection exigindo os jobs do CI (config do GitHub, a fazer pelo dono)
- Próxima sprint: Sprint 1 (dev-backend)

### Sprint 1 — Domínio, motor de upload e demo — ✅ concluída (2026-09-24) · dev-backend
- [x] S1.1 Schemas Zod do histórico e predicado "é música"
- [x] S1.2 Leitura do zip (fflate, streaming, limites)
- [x] S1.3 Dataset colunar
- [x] S1.4 Worker Comlink (progresso, cancelamento)
- [x] S1.5 Stats puras (período, tops, totais, heatmap, plataforma)
- [x] S1.6 Métricas "você por você"
- [x] S1.7 Stats de API (tendências, gêneros, curtidas por artista)
- [x] S1.8 Gerador demo determinístico
- [x] S1.9 Fixtures (válidas e maliciosas)
- [x] S1.10 Testes ≥ 80% + benchmark
- Entregue:
  - `src/domain/history/*`: schema Zod (strip), `isMusic`, `isSkip`, unzip em streaming (`readZipEntries`), `DatasetBuilder`, `processHistory`
  - `src/domain/stats/*` (`computeStats`, `periodSchema`, `availableMonths`); `src/domain/time.ts`
  - `src/domain/api-stats/*` (`computeWindowTrends`, `computeGenres`, `LikedArtistsCounter`, `savedPageOffsets`, `missingArtistIds`); `src/domain/spotify-types.ts`
  - `src/domain/demo/*` (`generateDemo`, `demoSavedPage`, `demoArtist`)
  - `src/workers/history.worker.ts` + `history-worker-api.ts`
  - `scripts/make-fixtures.ts` + 9 fixtures em `tests/fixtures/`; `tests/perf/history.perf.ts`
- Versões instaladas: fflate 0.8.3, comlink 4.4.2 (`pnpm audit --audit-level=high`: sem vulnerabilidades)
- Números (Node 22.20, Windows):
  - 213 testes (15 arquivos) verdes
  - cobertura de `src/domain`: 100% linhas, 97,7% ramos, 98,8% funções
  - benchmark com 57,8 MiB de JSON (4 arquivos, 72 000 registros; zip de 3,8 MiB): zip em 0,99 s, JSONs soltos em 0,50 s
  - memória amostrada: RSS +73 MiB sobre a linha de base (pico de ~250 MiB no processo do Vitest, que já inclui os 58 MiB gerados em memória)
  - troca de período: ≤ 40 ms; 1ª chamada ~78 ms, que monta o índice local por fuso
  - demo: ~110 ms para ~34 mil registros e 3 anos
- Contratos para o frontend (S4/S5):
  - Worker: `Comlink.wrap<HistoryWorkerApi>(new Worker(new URL('../workers/history.worker.ts', import.meta.url), { type: 'module' }))`
    - `processHistory(files, Comlink.proxy(onProgress))` → `{ ok: true, dataset, report } | { ok: false, error: { code, … } }`
    - `cancel()` → `CANCELLED`
    - progresso: `{ stage: 'unzip'|'parse'|'aggregate'|'done', bytesRead, bytesTotal, filesDone, records }`
  - Códigos de erro para traduzir: `UNSUPPORTED_FILE`, `INVALID_ZIP`, `UNSAFE_PATH`, `TOO_MANY_ENTRIES`, `ENTRY_TOO_LARGE`, `TOTAL_TOO_LARGE`, `COMPRESSION_RATIO`, `NO_HISTORY_FILES`, `WRONG_EXPORT` (zip "Dados da conta"), `INVALID_JSON`, `UNEXPECTED_FORMAT`, `INVALID_RECORDS`, `CANCELLED`, `INTERNAL`
  - `computeStats(dataset, period, tz, { limit })` → `{ range, totals, top: { artists, tracks, albums }, heatmap, platforms, self }`
    - `tz` = `Intl.DateTimeFormat().resolvedOptions().timeZone`, validado com `resolveTimeZone`
    - `heatmap[weekday*24+hour]`, com weekday ISO: 0 = segunda
    - valores em `ms`; a UI converte para minutos
  - Demo: `generateDemo()` → `{ dataset, api, timeZone }`
    - `api.demo === true`: a UI não mostra "Abrir no Spotify"
    - `api.top.{artists,tracks}[range]`, `api.recent`, `demoSavedPage(api, offset)`, `demoArtist(api, id)`
- Decisões:
  - `dict.albums` virou `{ name, artist }[]` em vez de `string[]` (álbuns homônimos de artistas diferentes não se misturam, e o top de álbuns mostra o artista)
  - `SavedPage` ganhou `offset`, usado pela varredura concorrente
  - "Pulada" = `skipped === true` ou, sem `skipped`, `reason_end === 'fwdbtn'`
  - Os distintos (artistas/músicas/álbuns/dias) contam só plays ≥ 30 s; os minutos somam toda música
  - Arquivo com > 5% de inválidos → `INVALID_RECORDS`; 100% inválido → `UNEXPECTED_FORMAT` (ou `WRONG_EXPORT` se for do export "Dados da conta")
  - Zip com qualquer entrada insegura (`..`, absoluta, letra de unidade, NUL) é rejeitado por inteiro
  - Limites checados no cabeçalho e durante o streaming, com pushes de 16 KiB ao fflate (saída máx. ~16 MiB por push). A razão é medida por entrada e acumulada, só depois de 1 MiB descompactado
  - Tendências: `short_term` contra `medium_term` (ou `long_term` se `medium` vier vazio); subiu/caiu com ≥ 3 posições; "saiu" = estava no top 20 da referência
  - Gêneros: peso N − i por artista; seção visível com ≥ 3 gêneros
  - Curtidas: cada faixa conta uma vez por artista creditado, com dedupe por ID de faixa e offsets repetidos ignorados
  - Demo: tops com 25 itens (com 36 artistas fictícios, 50 cobriria todos e "entrou" nunca apareceria); fuso `America/Sao_Paulo`; URLs genéricas `https://open.spotify.com/`
  - ESLint: `fetch`/XHR/WebSocket/EventSource/`sendBeacon`/storage proibidos em `src/domain` e `src/workers`
  - Scripts TS rodam direto no Node (type stripping, Node ≥ 22.18); `scripts/package.json` marca ESM
- Como verificar:
  - `pnpm i` → `pnpm lint && pnpm format:check && pnpm typecheck && pnpm test`
  - `pnpm test:coverage`: o limiar de 80% em `src/domain` é aplicado
  - `pnpm bench`: imprime `[bench]` com tempo e memória; falha se passar de 10 s ou se a troca de período passar de 200 ms
  - `pnpm fixtures`: regenera `tests/fixtures/` byte a byte; `tests/fixtures.test.ts` falha se as fixtures estiverem desatualizadas
  - `pnpm build` e `pnpm test:e2e` (7 testes) seguem verdes
- Nota de ambiente local: o pnpm 12 do scratchpad (`env.sh` da Sprint 0) é um shim `sh` que o `cmd` não executa. Com ele, o `webServer` do Playwright falha. Solução local: `pnpm build && pnpm start` num terminal e `pnpm test:e2e` em outro (reusa o servidor). Com o pnpm instalado normalmente, ou no CI, não acontece
- Pendências:
  - S4: ligar o worker à UI, traduzir os códigos de erro e esconder links do Spotify no Demo
  - S7: revisar os limites do zip e a regra de lint anti-rede
  - S8: medir no iPhone real (RNF-03/04). No Node a folga é grande, mas o Safari/iOS precisa de medição
- Próxima sprint: Sprint 2 (dev-backend) — `jose`, sessão, rotas `/api/spotify/*` usando os schemas de `src/domain/spotify-types.ts` para reduzir e validar as respostas

### Sprint 2 — BFF e integração Spotify — ⬜ · dev-backend
- [ ] S2.1 Sessão JWE (jose)
- [ ] S2.2 `/api/auth/{login,callback,logout}`
- [ ] S2.3 `spotify-client.ts` (refresh, 429, quota, invalid_grant, 403)
- [ ] S2.4 Rotas `/api/spotify/*` com Cache-Control private
- [ ] S2.5 Logger com allowlist + CSRF no logout
- [ ] S2.6 Testes de integração (100% dos caminhos de segurança)
- [ ] S2.7 `docs/api.md`

### Sprint 3 — Sistema de design — ✅ concluída e aprovada pelo cliente (2026-09-24) · designer
- Decisões do cliente (2026-09-24):
  - direção Palco Neon aprovada;
  - capa da música nº 1 no card do Conectar **liberada** (ADR 9 em 03);
  - fonte CJK/árabe nos cards **fora do MVP**.
- [x] S3.1 `10-design.md`: tokens Palco Neon (contrastes calculados, bloco `@theme` do Tailwind 4 em §12)
- [x] S3.2 Componentes e estados (§8)
- [x] S3.3 Templates de card (Básico/Festival × 9:16/1:1) — §9 + protótipo `design/cards/templates.mjs` validado no satori 0.33.5; prévias em `design/cards/preview/`
- [x] S3.4 Checklist de branding do Spotify (§10)
- [x] S3.5 `design/mockup.html` (dashboard mobile Upload + sheet de compartilhar com card Festival 9:16/1:1; interativo, sem overflow em 360 px)
- [x] S3.6 Fontes (OFL, de google/fonts) em `docs/projeto/design/fonts/` — TTF estáticos p/ satori + WOFF2 variáveis p/ web; o dev-frontend move para `public/fonts` na S4.1
- Como verificar: abrir `docs/projeto/design/mockup.html` no navegador; ver `docs/projeto/design/cards/preview/*.png`; ler `10-design.md` (§12 = bloco `@theme` pronto p/ `globals.css`)
- Pendências p/ cliente/ADR (10-design §15): aprovar direção; capas no card Conectar exigem `i.scdn.co` na CSP ou proxy (ADR); fonte CJK nos cards fora do MVP; logo oficial Spotify baixado na S5.5
- Próximo papel: cliente aprova → dev-frontend (S4.1 lê `10-design.md` §2–§8, §12, §13; S6 lê §9 e `design/cards/templates.mjs`)

### Sprint 4 — UI: landing, onboarding, upload e dashboard — ⬜ · dev-frontend → vertical slice com o cliente
- [ ] S4.1 Tokens e componentes base; layout; idioma
- [ ] S4.2 Landing + página de privacidade
- [ ] S4.3 Onboarding + `.ics`
- [ ] S4.4 Fluxo de upload
- [ ] S4.5 Dashboard de upload e demo
- [ ] S4.6 Modo Demo
- [ ] S4.7 Testes + e2e (incluindo o teste de rede de privacidade) + axe

### Sprint 5 — UI modo Conectar — ⬜ · dev-frontend
- [ ] S5.1 Conectar, estados de login e logout
- [ ] S5.2 TanStack Query com TTLs, quota e limpeza
- [ ] S5.3 Dashboard Conectar (janelas, tops, tendências, recentes, gêneros)
- [ ] S5.4 Varredura de curtidas
- [ ] S5.5 Atribuição Spotify
- [ ] S5.6 Testes

### Sprint 6 — Cards e compartilhamento — ⬜ · dev-frontend
- [ ] S6.1 Pipeline satori → resvg → PNG (lazy)
- [ ] S6.2 Templates × formatos × modos
- [ ] S6.3 Prévia + Web Share / download
- [ ] S6.4 Testes + iPhone real

### Sprint 7 — Segurança — ⬜ · analista-de-seguranca
- [ ] S7.1 Revisão do modelo de ameaças
- [ ] S7.2 Auditoria do BFF
- [ ] S7.3 Auditoria do cliente
- [ ] S7.4 SCA, CodeQL, segredos, CVEs
- [ ] S7.5 Pentest leve + correções
- [ ] S7.6 LGPD e branding

### Sprint 8 — Validação, UAT e deploy — ⬜ · orquestrador + analista-de-infra
- [ ] S8.1 Validação de rotas e fluxos vs. user stories
- [ ] S8.2 Medições (Lighthouse, benchmark, memória)
- [ ] S8.3 Vercel + redirect URIs + allowlist
- [ ] S8.4 Go-live
- [ ] S8.5 UAT com o cliente
