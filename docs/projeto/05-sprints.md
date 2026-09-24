# 05 — Sprints

> Ordem: fundação → domínio/motor de upload + demo → BFF → design (**aprovação do cliente**) → UI upload/demo
> (**vertical slice, validação do cliente**) → UI conectar → cards → segurança → validação/UAT/deploy.
> A Sprint 3 (design) pode rodar em paralelo às Sprints 1–2, porque não há dependência entre elas.
> Segurança e testes entram em **todas** as sprints.

## Sprint 0 — Fundação · `analista-de-infra`
**Objetivo:** esqueleto rodando localmente e CI verde.
- [ ] S0.1 Criar o app Next 16.3.x (App Router, TS 6 `strict`, Tailwind 4, Turbopack) com pnpm 12 (`packageManager`), `.nvmrc` = 24
- [ ] S0.2 Estrutura de pastas (`src/domain`, `src/server`, `src/features`, `src/workers`, `app/[locale]`), aliases de path
- [ ] S0.3 ESLint flat (next + typescript-eslint), Prettier, scripts `lint`, `typecheck`, `test`, `test:e2e`, `build`
- [ ] S0.4 next-intl com `/pt-BR` e `/en`, mensagens iniciais, página placeholder
- [ ] S0.5 `proxy.ts` com nonce de CSP + cabeçalhos (HSTS, nosniff, `frame-ancestors 'none'`, `Referrer-Policy: no-referrer`, Permissions-Policy)
- [ ] S0.6 `.env.example` (catálogo de 03), validação de env com Zod em `src/server/env.ts`, flag "Conectar desabilitado" quando faltam credenciais
- [ ] S0.7 Vitest + Testing Library + Playwright + axe configurados, com um teste de exemplo de cada
- [ ] S0.8 GitHub Actions (`permissions: contents: read`, actions fixadas por SHA): lint, typecheck, test, build, e2e (demo), `pnpm audit --audit-level=high`, dependency-review; Dependabot semanal agrupado; `pnpm` com `minimumReleaseAge`
- [ ] S0.9 README: visão, "como rodar" (`pnpm i` → `.env.local` → `pnpm dev` → `http://127.0.0.1:3000`), scripts, como cadastrar o app no Spotify
- **Aceite:** `pnpm dev` sobe em 127.0.0.1:3000 nos dois idiomas; cabeçalhos presentes; CI verde.

## Sprint 1 — Domínio, motor de upload e demo · `dev-backend` (TS de domínio, roda no browser)
**Objetivo:** toda a lógica testável sem UI.
- [ ] S1.1 Schemas Zod do registro do histórico (`strip`, descartando `ip_addr`/`conn_country`) e predicado "é música"
- [ ] S1.2 Leitura do zip com fflate em streaming: só `Streaming_History_Audio_*.json`; limites (entradas ≤ 200, arquivo ≤ 100 MB descompactado, total ≤ 1 GB, razão de compressão ≤ 100); JSONs soltos também aceitos
- [ ] S1.3 Construção do Dataset colunar (dicionários + TypedArrays), um arquivo por vez; tolerância de até 5% de registros inválidos
- [ ] S1.4 Worker `history.worker.ts` via Comlink: progresso por etapa, cancelamento, transferables
- [ ] S1.5 Stats puras: filtro de período, tops (artistas, músicas, álbuns), totais, heatmap (fuso local), plataforma
- [ ] S1.6 Métricas "você por você": fã desde, % dos plays, dias diferentes, mais pulada, dia mais musical
- [ ] S1.7 Stats de API puras: tendências entre janelas, gêneros ponderados, contagem de curtidas por artista
- [ ] S1.8 Gerador **demo** determinístico (seed fixa): ~3 anos de histórico fictício + respostas fictícias da API (artistas e músicas inventados)
- [ ] S1.9 Fixtures de teste: zip válido pequeno, zip com podcast, zip malicioso (bomb, path traversal, JSON inválido, formato inesperado)
- [ ] S1.10 Testes unitários (≥ 80% em `src/domain`) + benchmark do processamento de ~50 MB sintéticos (< 10 s em Node)
- **Aceite:** testes verdes; o benchmark cumpre a meta; zips maliciosos são rejeitados com erro tipado.

## Sprint 2 — BFF e integração Spotify · `dev-backend`
- [ ] S2.1 `session.ts` (jose JWE `dir`/A256GCM, `kid`, rotação com `SESSION_SECRET_PREVIOUS`), cookie `HttpOnly; Secure; SameSite=Lax; Max-Age ≤ 30 d`
- [ ] S2.2 `/api/auth/login` (PKCE S256 + `state` em cookie temporário selado, 10 min), `/callback` (valida `state`, troca o code, sem logar a query), `/logout` (POST, apaga o cookie)
- [ ] S2.3 `spotify-client.ts`: timeout, refresh automático, 429/`Retry-After`, `QUOTA_EXCEEDED`, `invalid_grant`, 403 fora da allowlist → erros tipados
- [ ] S2.4 Rotas `/api/spotify/{me,top,recent,saved,artist/:id}` com validação Zod, respostas reduzidas, `Cache-Control: private` + `Vary: Cookie`
- [ ] S2.5 Logger com allowlist de campos; proteção CSRF no logout (POST + verificação de `Origin`)
- [ ] S2.6 Testes de integração com mocks do Spotify (msw ou fetch mock): sucesso, sem sessão, `state` inválido, `invalid_grant`, 429, `QUOTA_EXCEEDED`, 403, parâmetros inválidos, cabeçalho de cache
- [ ] S2.7 `docs/api.md` (rotas, parâmetros, erros)
- **Aceite:** login real funciona em 127.0.0.1 com a conta do autor; 100% dos caminhos de segurança testados.

## Sprint 3 — Sistema de design · `designer` → **aprovação do cliente**
- [ ] S3.1 `10-design.md`: tokens "Palco Neon" (cor, tipo Bricolage Grotesque + Inter, espaço, raio, sombra, movimento), contraste verificado
- [ ] S3.2 Componentes e estados: botões, chips/segmented, seletor de período, cards de métrica, ranking, heatmap + tabela, abas de modo, toasts, modal de compartilhamento, skeletons, erros (zip inválido, 429, quota, fora da allowlist), selo de privacidade
- [ ] S3.3 Templates de card: Básico e Line-up de festival × 9:16 e 1:1 (área segura, truncamento, atribuição Spotify)
- [ ] S3.4 Checklist de branding do Spotify aplicado
- [ ] S3.5 `docs/projeto/design/mockup.html`: dashboard mobile + prévia do card de festival 9:16
- [ ] S3.6 Fontes TTF + WOFF2 (licença OFL) em `public/fonts`
- **Aceite:** o cliente aprova a direção visual antes da Sprint 4.

## Sprint 4 — UI: landing, onboarding, upload e dashboard (upload/demo) · `dev-frontend` → **vertical slice com o cliente**
- [ ] S4.1 Tokens e componentes base a partir do `10-design.md`; layout responsivo; troca de idioma
- [ ] S4.2 Landing (3 modos + selo de privacidade) e página de privacidade (LGPD)
- [ ] S4.3 Onboarding "como pedir seu histórico" + `.ics` gerado no cliente
- [ ] S4.4 Fluxo de upload: dropzone, progresso por etapa, cancelar, erros
- [ ] S4.5 Dashboard de upload e demo: seletor de período, totais, tops, heatmap + tabela, plataforma, métricas "você por você"
- [ ] S4.6 Modo Demo ligado ao gerador
- [ ] S4.7 Testes de componente + e2e (demo; upload de fixture; **teste de rede provando que o upload não envia dados**) + axe
- **Aceite:** o fluxo Upload → Dashboard roda de ponta a ponta; o cliente valida o rumo.

## Sprint 5 — UI modo Conectar · `dev-frontend`
- [ ] S5.1 Botão Conectar (desabilitado se não houver credenciais), estados de login, allowlist e reconexão, logout
- [ ] S5.2 TanStack Query com os TTLs de 03, pausa por `QUOTA`, respeito a `retryAfter`, persistência opcional em sessionStorage, limpeza no logout
- [ ] S5.3 Dashboard Conectar: seletor de janela, top artistas/músicas, tendências, tocadas recentemente, gêneros (degradação)
- [ ] S5.4 Varredura de curtidas sob demanda (progresso, cancelar, validação barata) → artista com mais curtidas
- [ ] S5.5 Atribuição Spotify (logo e "Abrir no Spotify") em todos os metadados; capas conforme as guidelines
- [ ] S5.6 Testes (componentes com mocks do BFF; e2e do modo Conectar via demo/mocks)
- **Aceite:** o autor vê os próprios dados reais; os erros 401/403/429/quota aparecem corretamente.

## Sprint 6 — Cards e compartilhamento · `dev-frontend`
- [ ] S6.1 Pipeline satori → resvg-wasm → PNG com carregamento lazy e fontes TTF
- [ ] S6.2 Templates Básico e Festival × 9:16 e 1:1 para os 3 modos (atribuição Spotify quando houver dado da API)
- [ ] S6.3 Modal de prévia; blob gerado **antes** do toque; `navigator.canShare({files})` → share, senão download
- [ ] S6.4 Testes (snapshot visual no Vitest Browser Mode; e2e do download no demo); verificação em iPhone real
- **Aceite:** card compartilhado em ≤ 3 toques no celular; Lighthouse do dashboard não cai abaixo de 90.

## Sprint 7 — Segurança · `analista-de-seguranca`
- [ ] S7.1 Revisar o modelo de ameaças de `08-seguranca.md` contra o código entregue
- [ ] S7.2 Auditoria do BFF: OAuth (state, PKCE, redirect), sessão JWE, CSRF, authz (sem token vindo do cliente), cabeçalhos de cache, logs
- [ ] S7.3 Auditoria do cliente: XSS (metadados do Spotify e nomes do arquivo renderizados), CSP efetiva, zip malicioso, armazenamento local
- [ ] S7.4 SCA (`pnpm audit`, dependency-review), CodeQL, secret scanning; CVEs atuais de Next.js/React
- [ ] S7.5 Pentest leve local (ZAP baseline ou equivalente) e correções até zerar falha alta/crítica
- [ ] S7.6 Revisão de conformidade: LGPD (página de privacidade) e branding Spotify
- **Aceite:** relatório em `docs/projeto/relatorio-seguranca.md`, sem falha alta/crítica aberta.

## Sprint 8 — Validação, UAT e deploy · orquestrador + `analista-de-infra`
- [ ] S8.1 Validação de rotas e fluxos contra as user stories (checklist do 06), e2e completo verde
- [ ] S8.2 Medições: Lighthouse, benchmark de upload no desktop e no iPhone, memória
- [ ] S8.3 Projeto na Vercel (env por ambiente, Deployment Protection em previews), redirect URIs cadastradas, allowlist
- [ ] S8.4 Checklist de go-live (09) e deploy em produção
- [ ] S8.5 UAT com o cliente (roteiro do 06) e registro do aceite no PROGRESSO.md
- **Aceite:** o cliente aprova; produção no ar.

## Definição de Pronto (DoD), válida para toda tarefa
- [ ] Lint, format e typecheck passam; sem `any` injustificado
- [ ] Testes escritos e verdes; cobertura ≥ 80% em `src/domain`, 100% nos caminhos de segurança do BFF
- [ ] Caminhos de erro e segurança testados (entrada inválida, sem sessão, limites)
- [ ] Nenhum dado de escuta, token ou `code` em log, storage persistente ou resposta cacheável publicamente
- [ ] Sem vulnerabilidade alta/crítica (audit/CodeQL); sem segredos no código
- [ ] UI: responsiva (360 px+), axe sem violações sérias, textos em PT-BR e EN
- [ ] README, `docs/api.md` e ADRs atualizados quando aplicável
- [ ] `docs/projeto/PROGRESSO.md` atualizado passo a passo
