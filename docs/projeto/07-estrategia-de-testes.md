# 07 — Estratégia de testes

## Pirâmide
| Nível | Ferramenta | O quê | Onde |
|---|---|---|---|
| Unitário (maioria) | Vitest (Node) | `src/domain/**`: parse/validação, limites do zip, Dataset, stats, métricas, tendências, gêneros, gerador demo | local + CI |
| Integração | Vitest + mock de `fetch` (msw) | Rotas `/api/auth/*` e `/api/spotify/*`, `session.ts`, `spotify-client.ts` | local + CI |
| Componente | Vitest + Testing Library (jsdom) / Browser Mode | Dropzone, seletor de período, heatmap + tabela, estados de erro, cards (snapshot visual em Browser Mode) | local + CI |
| E2E | Playwright (Chromium + WebKit) | Demo completo; upload da fixture; card download; Conectar com o BFF mockado (`SPOTIFY_API_BASE` apontando para mock) | CI |
| A11y | @axe-core/playwright | Landing, onboarding, dashboards, modal do card | CI |
| Privacidade | Playwright (`page.route`) | Durante o upload, **nenhuma** requisição com corpo sai do navegador | CI |
| Desempenho | Benchmark Vitest + Lighthouse CI (manual na Sprint 8) | ~50 MB sintéticos < 10 s em Node; Lighthouse ≥ 90 | local / Sprint 8 |

## Metas de cobertura
- `src/domain/**` ≥ 80% de linhas e ramos.
- Caminhos de segurança do BFF: **100%**:
  - `state` inválido;
  - sem sessão;
  - `invalid_grant`;
  - 403;
  - 429;
  - `QUOTA_EXCEEDED`;
  - parâmetros inválidos;
  - `Cache-Control` sempre `private` e com `Vary: Cookie`.

## Dados de teste
- **Fixtures geradas por script** (`scripts/make-fixtures.ts`), versionadas em `tests/fixtures/`. Nenhum dado real de ninguém:
  - zip válido com 2 arquivos;
  - zip com podcast e audiolivro;
  - zip bomb (razão alta);
  - path traversal (`../`);
  - JSON inválido;
  - formato inesperado;
  - arquivo não-histórico.
- **Gerador demo** com seed fixa, que também serve de base para os testes de stats (resultados conhecidos).
- **Mocks da API do Spotify** em `tests/mocks/spotify.ts`.

## Testes de segurança
- Estáticos: CodeQL, `pnpm audit --audit-level=high` e dependency-review no PR.
- Testes que falham se:
  - uma rota do BFF responder sem `private`;
  - o logger emitir campos fora da allowlist;
  - existir `console.log` em `app/api/**` (regra de lint).
- ZAP baseline na Sprint 7 (manual).

## Gates de CI (bloqueiam o merge)
lint · typecheck · unit/integração com cobertura mínima · build · e2e + axe (sem violações `serious`/`critical`) · audit alto/crítico · dependency-review · CodeQL.

## Verificação manual obrigatória
Upload grande e card compartilhado em **iPhone real** (Safari) e num Android (Chrome), na Sprint 6 e na Sprint 8.
