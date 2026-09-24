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
| Logs | Interno | Vercel (retenção 1 h no Hobby) | Só metadados de rota/status/duração |

## Modelo de ameaças (STRIDE leve)
| Ameaça | Vetor | Contramedida |
|---|---|---|
| **S**poofing / login CSRF | Callback forjado | `state` aleatório de 32 bytes em cookie selado, comparado em tempo constante; PKCE S256 |
| Roubo de token | XSS lendo o token | Tokens nunca vão ao JS (HttpOnly JWE); CSP com nonce e `strict-dynamic`; sem `dangerouslySetInnerHTML` |
| **T**ampering do cookie | Editar ou forjar a sessão | JWE A256GCM autenticado; chave de 32 bytes; `kid` |
| **R**epúdio | — | Irrelevante: sem ações de escrita. Logs mínimos de auth (sucesso/falha, sem PII) |
| **I**nformation disclosure (CDN) | Cache compartilhado servindo dados de outro usuário | `Cache-Control: private` + `Vary: Cookie`; `public`/`s-maxage` proibidos, com teste |
| Vazamento em log | Log de corpo, `code` ou token | Logger com allowlist; lint contra `console.*` em `app/api` |
| Vazamento do upload | Envio acidental do arquivo | Worker sem `fetch`; `connect-src` na CSP restrito a `'self'` e ao Spotify; teste e2e de rede |
| Vazamento por Referer | Links externos | `Referrer-Policy: no-referrer`; `rel="noopener noreferrer"` |
| XSS por metadados | Nome de música ou artista malicioso no JSON ou na API | Render só via React (escapado); satori recebe texto puro; nomes de arquivo nunca viram HTML |
| **D**oS local | Zip bomb, JSON gigante | Limites (entradas, tamanho, razão de compressão), streaming, cancelamento |
| Esgotar a quota | Varredura abusiva | Só usuários da allowlist; concorrência limitada; TTLs; pausa em `QUOTA` |
| **E**levação | Proxy aberto (SSRF) | O BFF só chama URLs fixas do Spotify; `id` validado por regex; sem URL vinda do cliente |
| Clickjacking | iframe | `frame-ancestors 'none'` |
| Supply chain | Dependência maliciosa | pnpm (scripts bloqueados, `minimumReleaseAge`), lockfile, Dependabot, audit, dependency-review, actions fixadas por SHA |

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

## Mapeamento OWASP Top 10 (2025) e API Top 10
| Item | Controle |
|---|---|
| A01 Broken Access Control / API1 BOLA | Sem IDs de usuário no cliente; só `/me` |
| A02 Security Misconfiguration | Cabeçalhos no `proxy.ts`; env validado; previews protegidos |
| A03 Software Supply Chain Failures | pnpm, audit, Dependabot, CodeQL, SHAs fixados |
| A04 Cryptographic Failures | JWE A256GCM, TLS/HSTS, segredos de 32 bytes |
| A05 Injection / XSS | React escapando; CSP nonce; Zod em todos os parâmetros |
| A06 Insecure Design | Privacidade por arquitetura (processamento no cliente, sem banco) |
| A07 Authentication Failures | PKCE + `state`; refresh com `invalid_grant` tratado |
| A08 Software/Data Integrity | Lockfile; sem scripts de terceiros em runtime; fontes self-hosted |
| A09 Logging & Alerting Failures | Logs mínimos de auth sem PII |
| A10 Mishandling of Exceptional Conditions | Erros tipados; nenhum stack trace ao cliente |
| API4 Unrestricted Resource Consumption | Limites no BFF (`offset` máx.), concorrência limitada, tratamento de quota |
| API7 SSRF | URLs fixas do Spotify |
| API10 Unsafe Consumption of APIs | Validação Zod das respostas do Spotify |

> O `analista-de-seguranca` confirma a numeração atual do OWASP Top 10 na Sprint 7.

## Cabeçalhos
| Cabeçalho | Valor |
|---|---|
| `Content-Security-Policy` | `default-src 'self'; script-src 'self' 'nonce-{n}' 'strict-dynamic' 'wasm-unsafe-eval'; style-src 'self' 'nonce-{n}'; img-src 'self' data: blob: https://i.scdn.co https://*.spotifycdn.com; connect-src 'self'; font-src 'self'; worker-src 'self' blob:; object-src 'none'; base-uri 'none'; form-action 'self' https://accounts.spotify.com; frame-ancestors 'none'; upgrade-insecure-requests` |
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains; preload` |
| `X-Content-Type-Options` | `nosniff` |
| `Referrer-Policy` | `no-referrer` |
| `Permissions-Policy` | Câmera, microfone e geolocalização desabilitados |
| `Cross-Origin-Opener-Policy` | `same-origin` |

`'wasm-unsafe-eval'` é necessário para o resvg-wasm. Validar na Sprint 7 se basta aplicá-lo só à rota de cards.

## Pipeline (DevSecOps proporcional)
- **SAST:** CodeQL (default setup) + ESLint security rules.
- **SCA:** `pnpm audit --audit-level=high` bloqueante, dependency-review no PR, Dependabot.
- **Segredos:** GitHub secret scanning + push protection; `.env*` no `.gitignore` (exceto `.env.example`).
- **DAST:** ZAP baseline manual na Sprint 7.

## Resposta a incidentes (porte pessoal)
**Suspeita de vazamento de segredo:**
1. Rotacionar o `SPOTIFY_CLIENT_SECRET` no dashboard do Spotify e o `SESSION_SECRET` na Vercel. A troca do `SESSION_SECRET` invalida todas as sessões.
2. Fazer redeploy.
3. Avisar os até 4 usuários da allowlist.

**Vulnerabilidade em dependência:** atualizar e fazer deploy em até 72 h (em até 24 h se for crítica).
