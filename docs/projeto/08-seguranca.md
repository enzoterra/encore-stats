# 08 — Segurança

## Ativos
1. Tokens OAuth do Spotify (access e refresh).
2. Histórico de escuta. É PII comportamental: revela hábitos, horários e localização aproximada (via `ip_addr`, que não é lido).
3. Perfil básico (`id`, nome, foto).
4. `SPOTIFY_CLIENT_SECRET` e `SESSION_SECRET`.
5. Reputação e Client ID do app (risco de revogação pelo Spotify).

## Classificação de dados
| Dado | Classe | Onde vive | Retenção |
|---|---|---|---|
| Histórico enviado | Sensível (PII) | Só na memória do navegador (worker → Zustand) | Até fechar ou recarregar a aba |
| Respostas da API | Pessoal | Memória / sessionStorage do navegador; trânsito pelo BFF sem persistência | TTL (≤ 12 h) ou fim da aba; limpas no logout |
| Tokens | Segredo do usuário | Cookie JWE HttpOnly | ≤ 30 dias (refresh ≤ 6 meses pela regra do Spotify) |
| Segredos do app | Segredo | Env vars da Vercel (por ambiente) | Rotação manual; `SESSION_SECRET_PREVIOUS` |
| Logs do app | Interno | Vercel (retenção 1 h no Hobby) | Só metadados de rota/status/duração (allowlist) |
| Logs da plataforma | Interno (do provedor) | Vercel: IP, caminho com query (inclui o `code` do callback), status | Política da Vercel; o `code` é de uso único e inútil sem o `code_verifier` (PKCE, cookie HttpOnly) |

## Modelo de ameaças (STRIDE leve)
| Ameaça | Vetor | Contramedida |
|---|---|---|
| **S**poofing / login CSRF | Callback forjado | `state` aleatório de 32 bytes em cookie selado, comparado em tempo constante; PKCE S256 |
| Roubo de token | XSS lendo o token | Tokens nunca vão ao JS (HttpOnly JWE); CSP com nonce e `strict-dynamic`; sem `dangerouslySetInnerHTML` |
| **T**ampering do cookie | Editar ou forjar a sessão | JWE A256GCM autenticado; chave de 32 bytes; `kid` |
| **R**epúdio | — | Irrelevante: sem ações de escrita. Logs mínimos de auth (sucesso/falha, sem PII) |
| **I**nformation disclosure (CDN) | Cache compartilhado servindo dados de outro usuário | `Cache-Control: private` + `Vary: Cookie`; `public`/`s-maxage` proibidos, com teste |
| Vazamento em log | Log de corpo, `code` ou token | Logger com allowlist; lint contra `console.*` em `app/api` |
| Vazamento do upload | Envio acidental do arquivo | Worker sem rede pela própria CSP (`connect-src data:`); lint anti-rede em `src/domain`, `src/workers`, pipeline dos cards e telas do upload/dashboard/demo (inclui `window.fetch`); `connect-src` das páginas só `'self'` e `https://i.scdn.co`; teste e2e de rede |
| Vazamento por Referer | Links externos | `Referrer-Policy: no-referrer`; `rel="noopener noreferrer"` |
| XSS por metadados | Nome de música ou artista malicioso no JSON ou na API | Render só via React (escapado); satori recebe texto puro; nomes de arquivo nunca viram HTML |
| **D**oS local | Zip bomb, JSON gigante | Limites (entradas, tamanho, razão de compressão), streaming, cancelamento |
| Esgotar a quota | Varredura abusiva | Só usuários da allowlist; concorrência limitada; TTLs; pausa em `QUOTA` |
| **E**levação | Proxy aberto (SSRF) | O BFF só chama URLs fixas do Spotify; `id` validado por regex; sem URL vinda do cliente |
| Clickjacking | iframe | `frame-ancestors 'none'` + `X-Frame-Options: DENY` (páginas, API e assets) |
| Cookie de sessão copiado | Acesso ao aparelho/navegador | HttpOnly, `__Host-`, `Secure`, CSP estrita. **Risco aceito (S7):** a sessão é sem estado; um cookie copiado antes do logout vale até o teto de 30 d. Revogação: remover o app em spotify.com/account/apps (mata o refresh; o access token dura ≤ 1 h) ou trocar o `SESSION_SECRET` (derruba todas) |
| Resposta da API embutida por outro site | `<script>`/`<img>` apontando para `/api/*` | `Cross-Origin-Resource-Policy: same-origin`, `nosniff`, CSP `default-src 'none'` nas rotas `/api/*`; cookie `SameSite=Lax` |
| Resposta anômala do Spotify | Corpo gigante sem `Content-Length` | Leitura em streaming com teto de 2 MiB (`upstream.ts`, S7) |
| Segredo de teste em produção | Copiar o `SESSION_SECRET` público dos e2e | `env.ts` recusa esse valor em qualquer deploy da Vercel (S7) |
| Supply chain | Dependência maliciosa | pnpm 10 (scripts bloqueados com `strictDepBuilds`, `minimumReleaseAge` estrito, `blockExoticSubdeps`), lockfile, Dependabot, audit, dependency-review, actions fixadas por SHA |

## Autenticação e autorização
- OAuth 2.0 Authorization Code + PKCE (S256), escopos mínimos:
  - `user-top-read`
  - `user-read-recently-played`
  - `user-library-read`
- **Sessão:**
  - cookie `__Host-encore_session` (`Secure; HttpOnly; SameSite=Lax; Path=/`), `Max-Age` de 30 d;
  - o conteúdo é `{at, rt, exp, authAt}`.
- **Autorização:**
  - toda rota `/api/spotify/*` exige sessão válida e nega por padrão;
  - o único recurso acessado é `/me/*` do dono do token, então não existe IDOR possível: o servidor nunca aceita user id vindo do cliente.
- **Logout:** `POST` com verificação de `Origin`. Apaga o cookie; o cliente limpa o cache. A página de privacidade explica como revogar o app em spotify.com/account/apps.

## Mapeamento OWASP Top 10:2025 e API Security Top 10:2023

> Numeração conferida na Sprint 7 (top10.owasp.org/2025 e api-security.owasp.org; a edição 2023 do API Top 10 segue a vigente).
| Item | Controle |
|---|---|
| A01 Broken Access Control / API1 BOLA | Sem IDs de usuário no cliente; só `/me` |
| A02 Security Misconfiguration | Cabeçalhos no `proxy.ts`; env validado; previews protegidos |
| A03 Software Supply Chain Failures | pnpm, audit, Dependabot, CodeQL, SHAs fixados |
| A04 Cryptographic Failures | JWE A256GCM, TLS/HSTS, segredos de 32 bytes |
| A05 Injection / XSS | React escapando; CSP nonce; Zod em todos os parâmetros |
| A06 Insecure Design | Privacidade por arquitetura (processamento no cliente, sem banco) |
| A07 Authentication Failures | PKCE + `state`; refresh com `invalid_grant` tratado |
| A08 Software or Data Integrity Failures | Lockfile; sem scripts de terceiros em runtime; fontes self-hosted |
| A09 Security Logging and Alerting Failures | Logs mínimos de auth sem PII; falha do `security-audit.yml` semanal avisa o dono |
| A10 Mishandling of Exceptional Conditions | Erros tipados; nenhum stack trace ao cliente |
| API2 Broken Authentication | OAuth + PKCE, sessão JWE `dir`/A256GCM com algoritmos fixos, `kid`, teto absoluto de 30 d |
| API3 Broken Object Property Level Authorization | Respostas reduzidas (sem e-mail, país, popularidade…); parâmetros em objeto estrito |
| API4 Unrestricted Resource Consumption | Limites no BFF (`offset` máx., corpo do upstream ≤ 2 MiB), concorrência limitada, tratamento de quota; sem chamada ao Spotify antes de sessão válida |
| API8 Security Misconfiguration | CSP/CORP nas rotas `/api/*`; métodos não declarados → 405 |
| API7 SSRF | URLs fixas do Spotify |
| API10 Unsafe Consumption of APIs | Validação Zod das respostas do Spotify |

## Cabeçalhos

Valores reais conferidos na Sprint 7 com `pnpm build && pnpm start` (`curl -I`).

**Páginas** (`proxy.ts`, nonce por requisição):

| Cabeçalho | Valor |
|---|---|
| `Content-Security-Policy` | `default-src 'self'; script-src 'self' 'nonce-{n}' 'strict-dynamic'; style-src 'self' 'nonce-{n}'; img-src 'self' data: blob: https://i.scdn.co https://*.spotifycdn.com; connect-src 'self' https://i.scdn.co; font-src 'self'; worker-src 'self'; object-src 'none'; base-uri 'none'; form-action 'self' https://accounts.spotify.com; frame-ancestors 'none'` (+ `upgrade-insecure-requests` em HTTPS) |
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains; preload` |
| `X-Content-Type-Options` | `nosniff` |
| `Referrer-Policy` | `no-referrer` |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=(), browsing-topics=(), payment=(), usb=()` |
| `Cross-Origin-Opener-Policy` | `same-origin` |
| `X-Frame-Options` | `DENY` (legado) |

**Scripts de Web Worker** (`/_next/static/*`, `next.config.ts`): `Content-Security-Policy: default-src 'none'; script-src 'self' 'wasm-unsafe-eval'; connect-src data:; base-uri 'none'`. Um worker usa a CSP da resposta do próprio script: `'wasm-unsafe-eval'` (satori/resvg) só existe ali, e os workers ficam sem rede.

**BFF** (`/api/*`, `next.config.ts`, S7): `Content-Security-Policy: default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'` e `Cross-Origin-Resource-Policy: same-origin`, além dos cabeçalhos estáticos acima e do `Cache-Control` de cada rota.

Mudanças da Sprint 7:
- `'wasm-unsafe-eval'` saiu das páginas (S6) e a validação ficou registrada: basta no worker.
- `worker-src` perdeu `blob:`: os dois workers vêm de `/_next/static` na própria origem.
- O Zod roda em modo `jitless` (`src/domain/zod-config.ts`): a sonda `new Function` do Zod 4 gerava 3 violações de CSP silenciosas por carregamento. O e2e agora também escuta o evento `securitypolicyviolation`.
- `HSTS preload`: com domínio próprio, todos os subdomínios passam a exigir HTTPS. Revisar antes de submeter à lista de preload.

## Pipeline (DevSecOps proporcional)
- **SAST:** CodeQL (default setup, ativado pelo dono) + regras do ESLint (`react/no-danger`, anti-rede, anti-storage, `no-console` no BFF). Em repositório privado, CodeQL exige GitHub Code Security.
- **SCA:** `pnpm audit --audit-level=high` bloqueante no CI e semanal (`security-audit.yml`); dependency-review no PR (só em repositório público ou com Code Security); Dependabot (atualizações de versão e alertas; desde a S8.0 o lockfile é do pnpm 10, com um documento YAML só, e o grafo de dependências volta a lê-lo).
- **Segredos:** GitHub secret scanning + push protection; `.env*` no `.gitignore` (exceto `.env.example`).
- **DAST:** pentest leve manual na Sprint 7 (curl + script Node + Playwright contra o build de produção e o mock; ZAP não usado para não instalar ferramenta nova). Refazer com ZAP baseline contra o staging na S8, se possível. Relatório: `relatorio-seguranca.md`.

## Resposta a incidentes (porte pessoal)
**Suspeita de vazamento de segredo:**
1. Rotacionar o `SPOTIFY_CLIENT_SECRET` no dashboard do Spotify e o `SESSION_SECRET` na Vercel. A troca do `SESSION_SECRET` invalida todas as sessões.
2. Fazer redeploy.
3. Avisar os até 4 usuários da allowlist.

**Vulnerabilidade em dependência:** atualizar e fazer deploy em até 72 h (em até 24 h se for crítica).
