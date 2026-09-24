# Progresso — Encore

## Estado atual
- Perfil: padrão-leve (web fullstack leve, sem banco, sem Docker, sem IA, Vercel)
- Fase: 2 — Planejamento concluído, **aguardando aprovação do cliente**
- Sprint em andamento: nenhuma (implementação não iniciada)
- Próximo passo ao retomar: com o plano aprovado, despachar a Sprint 0 (analista-de-infra) a partir de S0.1. A Sprint 3 (designer) pode rodar em paralelo às Sprints 1–2
- Última atualização: 2026-09-24 por orquestrador

## Fases
- [x] Fase 0: preparação (repositório greenfield; `docs/projeto/` criado)
- [x] Fase 1: descoberta (`00-descoberta.md`, aprovada pelo cliente)
- [x] Fase 2: planejamento (`01`–`03`, `05`–`09`, `PADROES.md`); **aguardando aprovação**
- [ ] Fase 3: implementação
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
### Sprint 0 — Fundação — ⬜ não iniciada · analista-de-infra
- [ ] S0.1 App Next 16.3.x + TS 6 strict + Tailwind 4 + pnpm 12 + `.nvmrc` 24
- [ ] S0.2 Estrutura de pastas e aliases
- [ ] S0.3 ESLint/Prettier e scripts
- [ ] S0.4 next-intl `/pt-BR` e `/en`
- [ ] S0.5 `proxy.ts` com CSP nonce e cabeçalhos
- [ ] S0.6 `.env.example` e `env.ts` com Zod; flag de Conectar desabilitado
- [ ] S0.7 Vitest, Testing Library, Playwright e axe
- [ ] S0.8 GitHub Actions + Dependabot + pnpm `minimumReleaseAge`
- [ ] S0.9 README "como rodar"

### Sprint 1 — Domínio, motor de upload e demo — ⬜ · dev-backend
- [ ] S1.1 Schemas Zod do histórico e predicado "é música"
- [ ] S1.2 Leitura do zip (fflate, streaming, limites)
- [ ] S1.3 Dataset colunar
- [ ] S1.4 Worker Comlink (progresso, cancelamento)
- [ ] S1.5 Stats puras (período, tops, totais, heatmap, plataforma)
- [ ] S1.6 Métricas "você por você"
- [ ] S1.7 Stats de API (tendências, gêneros, curtidas por artista)
- [ ] S1.8 Gerador demo determinístico
- [ ] S1.9 Fixtures (válidas e maliciosas)
- [ ] S1.10 Testes ≥ 80% + benchmark

### Sprint 2 — BFF e integração Spotify — ⬜ · dev-backend
- [ ] S2.1 Sessão JWE (jose)
- [ ] S2.2 `/api/auth/{login,callback,logout}`
- [ ] S2.3 `spotify-client.ts` (refresh, 429, quota, invalid_grant, 403)
- [ ] S2.4 Rotas `/api/spotify/*` com Cache-Control private
- [ ] S2.5 Logger com allowlist + CSRF no logout
- [ ] S2.6 Testes de integração (100% dos caminhos de segurança)
- [ ] S2.7 `docs/api.md`

### Sprint 3 — Sistema de design — ⬜ · designer → aprovação do cliente
- [ ] S3.1 `10-design.md`: tokens Palco Neon
- [ ] S3.2 Componentes e estados
- [ ] S3.3 Templates de card (Básico/Festival × 9:16/1:1)
- [ ] S3.4 Checklist de branding do Spotify
- [ ] S3.5 `design/mockup.html`
- [ ] S3.6 Fontes em `public/fonts`

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
