# API do BFF (Encore)

BFF mínimo e sem estado, same-origin, JSON. Só existe para o modo **Conectar**: OAuth com o
Spotify, sessão selada em cookie e um proxy fino que **reduz** as respostas da Web API aos tipos de
`src/domain/spotify-types.ts`. Upload e Demo não usam nenhuma destas rotas.

Código: `app/api/**` (rotas) e `src/server/**` (sessão, cliente do Spotify, logger, erros).

## Regras gerais

- **Negado por padrão.** Toda rota `/api/spotify/*` exige o cookie de sessão válido. Nenhuma rota
  aceita token, user id ou URL vindos do cliente: o único recurso é o `/me` do dono do token (sem
  IDOR possível) e o BFF só chama caminhos fixos do Spotify.
- **Parâmetros validados com Zod** (objetos estritos): parâmetro desconhecido, repetido ou fora do
  formato é `400 BAD_REQUEST`, sem chamar o Spotify.
- **Respostas do Spotify validadas e reduzidas.** Campos extras são descartados (popularidade,
  seguidores, e-mail, país, URIs…). Item inválido de uma lista (ex.: faixa local sem ID) é
  descartado; envelope inválido é `502 UPSTREAM`. Links "Abrir no Spotify" são montados a partir do
  ID validado (`https://open.spotify.com/{artist|track}/{id}`); imagens só dos CDNs do Spotify
  (`i.scdn.co`, `*.spotifycdn.com`), a de largura mais próxima de 300 px.
- **Cache:** sucesso com `Cache-Control: private, max-age=N` + `Vary: Cookie`; erro com
  `Cache-Control: private, no-store` + `Vary: Cookie`. `public` e `s-maxage` nunca aparecem (há
  teste que garante). As rotas de auth usam `Cache-Control: no-store`.
- **Logs:** JSON de uma linha com allowlist de campos (rota, método, status, duração, código,
  motivo, contadores). Nunca corpo, token, `code`, `state` ou query (`src/server/logger.ts`).

## Erros

Formato único: `{ "error": { "code": "<CÓDIGO>", "retryAfter"?: <segundos> } }`. Sem stack trace
nem mensagem do Spotify.

| Código             | Status | Quando                                                                                         | O que a UI faz                                   |
| ------------------ | ------ | ---------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| `UNAUTHENTICATED`  | 401    | Sem cookie, cookie inválido/adulterado/expirado (30 d) ou `invalid_grant` no refresh           | "Reconecte"; o cookie já vem apagado se existia  |
| `NOT_ALLOWLISTED`  | 403    | 403 do Spotify: conta fora do User Management do app em Development Mode                        | Mensagem da allowlist (RF-14)                    |
| `RATE_LIMITED`     | 429    | 429 comum que passou do teto de espera do BFF; `retryAfter` + cabeçalho `Retry-After`          | Tentar de novo depois de `retryAfter` s          |
| `QUOTA`            | 503    | 429 com `reason: QUOTA_EXCEEDED` (terminal); `retryAfter: 900`                                 | Pausar as queries por 15 min e avisar (RF-25)    |
| `UPSTREAM`         | 502    | 5xx persistente, timeout de 10 s, erro de rede, 4xx inesperado ou resposta fora do schema      | Erro da seção, com "tentar de novo"              |
| `BAD_REQUEST`      | 400    | Parâmetros inválidos                                                                           | Bug do cliente                                   |
| `NOT_FOUND`        | 404    | O Spotify não conhece o recurso (ex.: artista)                                                 | Esconder o item                                  |
| `CONNECT_DISABLED` | 404    | Ambiente sem credenciais do Spotify (todas as rotas de auth e `/api/spotify/*`)                | Botão Conectar desabilitado                      |
| `FORBIDDEN`        | 403    | Logout vindo de outra origem (CSRF)                                                            | —                                                |
| `INTERNAL`         | 500    | Erro inesperado no próprio BFF                                                                 | Erro genérico                                    |

### Resiliência (RNF-05)

- Timeout de **10 s** por tentativa (inclui a leitura do corpo). Timeout e erro de rede não repetem.
- **429 comum:** espera `Retry-After` + jitter (até 0,5 s); sem o cabeçalho, 1 s e depois 2 s. No
  máximo **2 novas tentativas** e **30 s** de espera somada. Se o `Retry-After` passar do teto, o
  BFF repassa `429 RATE_LIMITED` com `retryAfter` na hora.
- **`QUOTA_EXCEEDED`:** sem retry, `503 QUOTA`.
- **5xx:** 1 nova tentativa (dentro do limite de 2); depois, `502 UPSTREAM`.

## Rotas do Spotify (`GET`, exigem sessão)

| Rota                                          | Parâmetros                                                                                          | Chama no Spotify                                      | Resposta (tipos em `src/domain/spotify-types.ts`) | `max-age` |
| --------------------------------------------- | --------------------------------------------------------------------------------------------------- | ----------------------------------------------------- | ------------------------------------------------- | --------- |
| `/api/spotify/me`                             | nenhum                                                                                              | `GET /me`                                             | `Me` = `{ id, displayName, image? }`              | 86 400 (24 h) |
| `/api/spotify/top?type=&range=`               | `type` ∈ `artists`,`tracks`; `range` ∈ `short_term`,`medium_term`,`long_term`                       | `GET /me/top/{type}?time_range=&limit=50`             | `{ items: Artist[] }` ou `{ items: Track[] }`     | 21 600 (6 h) |
| `/api/spotify/recent`                         | nenhum                                                                                              | `GET /me/player/recently-played?limit=50`             | `{ items: Recent[] }` (`{ playedAt, track }`)     | 60        |
| `/api/spotify/saved?offset=&limit=`           | `offset` inteiro 0–100 000, múltiplo de 50 (padrão 0); `limit` ∈ `1`,`50` (padrão 50)              | `GET /me/tracks?offset=&limit=`                       | `SavedPage` = `{ total, offset, items[{ addedAt, track: { id, artists } }] }` | 43 200 (12 h) |
| `/api/spotify/artist/{id}`                    | `id` base62 com 22 caracteres (`^[A-Za-z0-9]{22}$`)                                                 | `GET /artists/{id}`                                   | `Artist` = `{ id, name, genres[], image?, url }`  | 604 800 (7 d) |

- `limit=1` no `saved` serve para validar o cache da varredura (03: comparar `total` e o primeiro
  `addedAt` antes de revarrer).
- `genres` vem vazio quando o Spotify não manda o campo (ele é deprecated; a UI degrada).
- Se o access token foi renovado durante a chamada, a resposta traz `Set-Cookie` com a sessão
  resselada (inclusive nas respostas de erro, quando o refresh deu certo e a falha foi depois).

### Recomendação para o cliente (Sprint 5)

Faça a **primeira** chamada da sessão sozinha (ex.: `me`) e só depois dispare as demais em
paralelo. Se o access token estiver vencido, requisições paralelas renovariam ao mesmo tempo; o
BFF tolera `invalid_grant` enquanto o access token atual ainda vale (> 5 s), mas com o token já
vencido a requisição perdedora devolve `401` e apaga o cookie.

## Fluxo OAuth (Authorization Code + PKCE S256)

```mermaid
sequenceDiagram
  participant B as Navegador
  participant A as BFF (/api/auth)
  participant S as accounts.spotify.com
  participant W as api.spotify.com
  B->>A: GET /api/auth/login?locale=pt-BR
  A-->>B: 302 /authorize (client_id, redirect_uri, scope, state, code_challenge S256)<br/>Set-Cookie encore_oauth (JWE: state, verifier, locale; 10 min)
  B->>S: login e consentimento
  S-->>B: 302 /api/auth/callback?code&state (ou ?error=access_denied&state)
  B->>A: GET /api/auth/callback (+ cookie encore_oauth)
  A->>A: abre o cookie, compara state em tempo constante
  A->>S: POST /api/token (Basic client_id:secret, code, redirect_uri, code_verifier)
  S-->>A: access_token, refresh_token, expires_in, scope
  A->>W: GET /me (403 = fora da allowlist → sem sessão)
  A-->>B: 302 /{locale}/connect[?error=]<br/>Set-Cookie encore_session (JWE {at, rt, exp, authAt}); apaga encore_oauth
```

| Rota                        | Método | Comportamento                                                                                                                                  |
| --------------------------- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `/api/auth/login?locale=`   | GET    | `state` e `code_verifier` de 32 bytes; cookie temporário selado (10 min); 302 para o `/authorize`. Escopos: `user-top-read user-read-recently-played user-library-read`. Aberto em outro host (ex.: `localhost`), responde 307 para a mesma rota na origem da redirect URI, onde os cookies vivem. `locale` inválido vira `pt-BR` |
| `/api/auth/callback`        | GET    | Sempre apaga o cookie temporário e responde 302 para `/{locale}/connect`, com `?error=` quando dá errado (tabela abaixo). A query nunca é logada |
| `/api/auth/logout?locale=`  | POST   | Checa a origem (abaixo), apaga os cookies e manda `Clear-Site-Data: "cache"` (descarta o cache HTTP com as respostas `private`). `fetch` → 204; formulário (navegação) → 303 para `/{locale}/connect`. `GET` → 405 |

Destino do callback: **`/{locale}/connect`** (hoje uma página provisória com o estado da
conexão e o botão de sair; a Sprint 5 faz a tela de verdade nessa rota ou redireciona dali para o
dashboard). Códigos de `?error=`:

| `error`           | Causa                                                                                  |
| ----------------- | -------------------------------------------------------------------------------------- |
| `denied`          | O usuário cancelou no Spotify (`error=access_denied`)                                   |
| `state`           | Cookie temporário ausente, adulterado, de outra chave ou expirado; `state` ausente ou diferente |
| `oauth`           | Outro erro do OAuth, `code` ausente ou recusado na troca (`invalid_grant`)             |
| `scope`           | O Spotify concedeu menos escopos que os pedidos                                         |
| `not_allowlisted` | `GET /me` respondeu 403: conta fora do User Management (nenhuma sessão é criada)        |
| `upstream`        | Spotify indisponível ou resposta inválida na troca do `code`                            |

### Sessão e cookies

- `encore_session`: JWE compacto `alg: dir` + `enc: A256GCM` (jose), com `kid` e `typ`. Conteúdo
  `{ at, rt, exp, authAt }` (`exp` = expiração do access token; `authAt` = login). Teto absoluto de
  **30 dias desde o login**: o `Max-Age` é o que resta desse teto, e o refresh não estende.
- Chaves derivadas por HKDF-SHA-256 do `SESSION_SECRET`, uma por finalidade (sessão e OAuth).
  **Rotação:** o novo segredo vai em `SESSION_SECRET` e o antigo em `SESSION_SECRET_PREVIOUS`;
  cookies antigos continuam abrindo (e são resselados com o novo no próximo refresh). Depois de
  30 dias, remova o anterior. Trocar só o `SESSION_SECRET` derruba todas as sessões.
- Refresh quando faltam **< 60 s** para o access token expirar (ou se a API responder 401, uma vez).
  Um `refresh_token` novo substitui o anterior. `invalid_grant` → `401` e cookie apagado (salvo a
  tolerância a refresh paralelo descrita acima).
- **Atributos:** `HttpOnly; SameSite=Lax; Path=/`, sem `Domain`.
  - Origem HTTPS (produção, staging, qualquer deploy da Vercel): nomes `__Host-encore_session` e
    `__Host-encore_oauth`, com `Secure`.
  - Dev local em `http://127.0.0.1` (a redirect URI de loopback do Spotify não tem HTTPS): nomes
    `encore_session` e `encore_oauth`, **sem** `Secure`. Motivo: o Safari descarta cookies `Secure`
    em HTTP, e o Chrome aceita `Secure` em loopback mas rejeita o prefixo `__Host-` fora de HTTPS.
    O `env.ts` só aceita HTTP em host de loopback e proíbe HTTP em qualquer deploy da Vercel, então
    esse modo não existe fora da máquina do desenvolvedor. Em HTTPS o nome sem prefixo não
    autentica (evita cookie plantado por subdomínio).

### CSRF no logout

`POST` + checagem de origem (`src/server/csrf.ts`). O site envia `Referrer-Policy: no-referrer`, e
com ela o navegador manda **`Origin: null`** em envio de formulário da própria origem (conferido no
Chromium: `fetch` manda a origem real; formulário manda `null` com `Sec-Fetch-Site: same-origin`).
Regra: sem `Origin` → 403; `Sec-Fetch-Site` presente e diferente de `same-origin` → 403; aceita
`Origin` igual à origem do app, ou `Origin: null` junto de `Sec-Fetch-Site: same-origin`.

## Configuração

Veja `.env.example` e `src/server/env.ts`. Além das credenciais e do `SESSION_SECRET`:

- `SPOTIFY_REDIRECT_URI` precisa terminar exatamente em `/api/auth/callback`; HTTPS, ou HTTP só em
  loopback fora da Vercel. Sua origem é a origem dos cookies.
- `SPOTIFY_API_BASE` / `SPOTIFY_ACCOUNTS_BASE` (opcionais): trocam as bases do Spotify por um mock.
  **Só aceitam URL de loopback** e são **proibidas quando `VERCEL_ENV` é `preview` ou
  `production`** (a app nem sobe). Fora da Vercel funcionam também com `pnpm build && pnpm start`
  (`NODE_ENV=production`), para os e2e locais e do CI. Sem elas, as bases são
  `https://api.spotify.com/v1` e `https://accounts.spotify.com`.

## Testar

- Unit/integração: `pnpm test` (os testes das rotas ficam em `app/api/**/*.test.ts`; os mocks do
  Spotify em `tests/mocks/spotify.ts`).
- Fluxo completo sem conta real: `node scripts/spotify-mock-server.ts` (mock em
  `http://127.0.0.1:4010`) e o app com as bases apontando para ele. Passo a passo no README.
