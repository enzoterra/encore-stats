# Relatório de segurança — Encore (Sprint 7)

- **Data:** 2026-09-24
- **Versão auditada:** `main` @ `530ffb9` (Sprints 0–6), mais as correções desta sprint (ainda sem commit)
- **Perfil:** padrão-leve. Web fullstack sem banco, BFF sem estado na Vercel, processamento do upload 100% no navegador
- **Resultado:** **nenhuma falha alta ou crítica aberta no código.**
  - 1 achado médio de conformidade (LGPD) foi corrigido; falta o dono informar os valores.
  - 2 achados médios dependem do dono ou do cliente (visibilidade de SCA no GitHub e Developer Policy do Spotify).
  - 1 dependência externa bloqueia o go-live: o Next.js 16.3.7, security release anunciado para 30/09.

## 1. Escopo

| Camada | O que foi revisado |
|---|---|
| BFF | Todas as rotas de `app/api/**` e todo `src/server/**`: OAuth, sessão JWE, cookies, CSRF, env, logger, upstream, mappers e cabeçalhos |
| Borda | `proxy.ts`, `next.config.ts` (cabeçalhos, aliases do Turbopack) e `pnpm-workspace.yaml` (override, `minimumReleaseAge`, `allowBuilds`) |
| Cliente | Toda superfície que renderiza dados externos, que busca rede ou que guarda dados:<br>• `src/features/**` (Conectar, cards, upload, dashboard, demo)<br>• `src/components/**`<br>• `src/workers/**`<br>• `src/domain/history/*` (zip, JSON e limites) |
| Supply chain | Lockfile, `pnpm audit`, CI (`.github/workflows`), Dependabot e histórico git inteiro (9 commits) |
| Conformidade | Página de privacidade (LGPD), branding e Developer Terms/Policy do Spotify |

Fora do escopo:
- infraestrutura da Vercel e configuração do projeto lá (fica para a S8);
- iPhone e Safari reais;
- a conta real do Spotify.

## 2. Metodologia

1. **Revisão manual do código**, linha a linha, no BFF e nos pontos sensíveis do cliente:
   - *sinks* de HTML e URL;
   - `fetch`;
   - storage;
   - `postMessage`/Comlink;
   - geração de SVG/PNG.
2. **Pesquisa de ameaças atuais** (2026-09-24):
   - OSV e GitHub Advisory API para cada versão exata do lockfile;
   - advisories do Next.js, React, satori, fflate e next-intl;
   - aviso prévio do Next.js 16.3.7;
   - OWASP Top 10:2025 e API Security Top 10:2023;
   - Spotify Developer Terms v10, Developer Policy e Design Guidelines;
   - dependabot-core#15904;
   - documentação do GitHub sobre dependency review.
3. **SCA:**
   - `pnpm audit --registry=https://registry.npmjs.org/`;
   - revisão do override da fflate e dos aliases do Turbopack.
4. **Segredos:** varredura do histórico git completo (`git log --all -p`) com padrões de:
   - chave privada;
   - AWS, GitHub, Slack e Google;
   - JWT/JWE;
   - tokens do Spotify (`BQ…`/`AQ…`);
   - hex de 32 caracteres (formato de client id/secret);
   - strings base64url de 43 caracteres (formato do `SESSION_SECRET`);
   - atribuições `*_SECRET=`/`*_ID=` com valor;
   - arquivos `.env*` versionados.

   Não foi instalada ferramenta nova (gitleaks e ZAP exigiriam download).
5. **Pentest leve** contra `pnpm build && pnpm start`, em três servidores:
   - `:3000` sem credenciais;
   - `:4010` com o mock do Spotify;
   - `:3100` com o Conectar ligado contra o mock.

   Ferramentas e técnicas:
   - script Node com 70 verificações (OAuth, sessão, parâmetros, CSRF, bypass de proxy);
   - `curl`, para os cabeçalhos que o `fetch` do Node proíbe (`Host`, `Sec-Fetch-*`);
   - Playwright/Chromium: storage real, cookies, workers e violações de CSP pelo evento `securitypolicyviolation`.
6. **Correção e reteste:** cada correção ganhou teste de regressão. A suíte inteira foi rodada de novo (seção 7).

## 3. Resumo dos achados

Severidade no estilo CVSS 3.1, com o vetor quando se aplica. Os de conformidade não têm vetor técnico.

| ID | Achado | Severidade | Status |
|---|---|---|---|
| S7-01 | Página de privacidade sem identificação do controlador e sem canal de contato garantido | **Médio** (conformidade LGPD) | Corrigido. O dono define os valores |
| S7-02 | SCA sem visibilidade no GitHub: o grafo do Dependabot não lê o lockfile do pnpm 12, e o dependency-review falha em repositório privado | **Médio** | Mitigado. Falta ação do dono |
| S7-03 | Developer Policy do Spotify proíbe "métricas derivadas" com dados da API | **Médio** (conformidade Spotify) | Decisão do cliente |
| S7-04 | Next.js 16.3.7: security release anunciado (1 crítica, 2 altas), sem detalhes até 30/09 | Não classificável ainda | Aberto (externo). Bloqueia o go-live |
| S7-05 | Rotas `/api/*` sem CSP nem CORP | Baixo, 3.1 (AV:N/AC:H/PR:N/UI:R/S:U/C:L/I:N/A:N) | Corrigido |
| S7-06 | Corpo do upstream lido inteiro antes de checar o limite (resposta sem `Content-Length`) | Baixo, 2.2 (AV:N/AC:H/PR:H/UI:N/S:U/C:N/I:N/A:L) | Corrigido |
| S7-07 | Violações de CSP silenciosas: sonda `new Function` do Zod 4; o e2e não as via | Baixo (monitoramento da CSP) | Corrigido |
| S7-08 | `worker-src` com `blob:` sem necessidade | Baixo (hardening) | Corrigido |
| S7-09 | `NEXT_PUBLIC_REPO_URL` aceitava qualquer esquema (`javascript:`) e vira `href` | Baixo (exige controle do env) | Corrigido |
| S7-10 | O `SESSION_SECRET` público dos e2e seria aceito num deploy | Baixo | Corrigido |
| S7-11 | Lint anti-rede não cobria as telas do upload/dashboard nem `window.fetch`/`globalThis.fetch` | Baixo (defesa em profundidade do RNF-01) | Corrigido |
| S7-12 | Sessão sem estado: um cookie copiado antes do logout vale até o teto de 30 d | Baixo, 3.1 (AV:P/AC:H/PR:N/UI:N/S:U/C:H/I:N/A:N ≈ 3,9) | Risco aceito |
| S7-13 | Sem rate limiting próprio no BFF | Baixo | Risco aceito, com recomendação |
| S7-14 | O `code` do OAuth aparece nos logs de requisição da plataforma (Vercel) | Baixo | Risco aceito |
| S7-15 | Informativos (seção 5) | Info | Registrados |

## 4. Achados em detalhe

### S7-01 — LGPD: controlador e contato (Médio) — corrigido

**Local:** `app/[locale]/privacy/page.tsx`, mensagens `Privacy.*`.

**Problema:**
- A página não identificava o controlador (art. 9º, III).
- O único contato era o link do repositório. Ele só aparece com `NEXT_PUBLIC_REPO_URL` definida e, com o repositório privado, não serve ao titular.
- Pequenos agentes de tratamento dispensam o encarregado, mas **precisam** de um canal de comunicação com o titular (Res. CD/ANPD nº 2/2022, art. 11).
- Também faltavam:
  - os direitos do art. 18 e o direito de peticionar à ANPD;
  - a transferência internacional (Vercel e Spotify fora do Brasil, art. 33);
  - os logs da própria plataforma de hospedagem (IP e caminho).

**Correção:**
- Novas variáveis `NEXT_PUBLIC_PRIVACY_CONTROLLER` (nome, ≤ 120 caracteres, sem `<>` nem caracteres de controle) e `NEXT_PUBLIC_PRIVACY_CONTACT` (e-mail validado).
  - São **obrigatórias em produção**: sem elas a app não sobe, como já acontece com `NEXT_PUBLIC_SITE_URL`.
  - Ficam opcionais localmente e em preview.
- Nova seção "Quem cuida dos seus dados" (`mailto:`). Sem e-mail, cai para o repositório.
- Textos PT-BR e EN atualizados:
  - base legal (art. 7º, V, mais a autorização revogável no Spotify);
  - art. 33, IX;
  - art. 18 e ANPD;
  - logs da Vercel.

**Testes:**
- `src/server/env.test.ts`: obrigatoriedade em produção, validação de formato e ausência fora de produção.
- `e2e/pages.spec.ts`: o novo título h2.

**Pendente do dono:** definir o nome do controlador e um e-mail de contato. Pode ser um alias dedicado, para não publicar o e-mail pessoal.

**Atualização (2026-09-25):** o cliente informou o controlador e o contato. Os valores vão só nas variáveis de Production e do `staging` na Vercel (checklist de go-live em `09-operacao-e-deploy.md`); o código continua sem valor padrão.

### S7-02 — SCA sem visibilidade no GitHub (Médio) — mitigado

**Evidências:**
- **Dependabot:** o lockfile do pnpm 12 tem dois documentos YAML (`pnpm-lock.yaml`, `---` nas linhas 1 e 158). O grafo de dependências do GitHub lê só o primeiro: [dependabot-core#15904](https://github.com/dependabot/dependabot-core/issues/15904), **aberto** em 2026-09-24. Resultado: cerca de 0 dependências no grafo, e alertas de segurança que não aparecem ou fecham sozinhos. As atualizações de versão do Dependabot já funcionam com o pnpm 12 (issue #16095, fechada em 2026-09-15).
- **Dependency review:** em repositório privado, a `dependency-review-action` exige GitHub Code Security ([docs](https://docs.github.com/en/code-security/supply-chain-security/understanding-your-software-supply-chain/about-dependency-review)). O job falharia em todo PR.
- **CodeQL:** também exige Code Security em repositório privado.

**Correção e mitigação:**
- `.github/workflows/ci.yml`: o `dependency-review` só roda se `!github.event.repository.private`.
- Novo `.github/workflows/security-audit.yml`:
  - toda segunda, `pnpm audit` completo (informativo) e `--audit-level=high` (falha);
  - também roda manual (`workflow_dispatch`);
  - uma advisory nova alta/crítica faz o job falhar, e o GitHub avisa o dono por e-mail. Isso cobre o período sem push.
- O `pnpm audit --audit-level=high` bloqueante no CI continua.

**Atualização (S8.0, 2026-09-25):** o projeto voltou para o pnpm 10.34.5 (a Vercel não roda o pnpm 11+). O lockfile agora tem um documento YAML só (sem `packageManagerDependencies`), que o grafo de dependências do GitHub lê: a causa do dependabot-core#15904 deixa de se aplicar. O `security-audit.yml` semanal continua, como redundância aos alertas do Dependabot. O dono confere em Insights → Dependency graph se as dependências aparecem.

**Pendente do dono:** seção 9.

### S7-03 — Developer Policy do Spotify: "métricas derivadas" (Médio) — decisão do cliente

**Evidência:** a [Developer Policy](https://developer.spotify.com/policy) proíbe usar o Spotify Content para:

> "creating new or derived listenership metrics, … usage statistics, user metrics, or building profiles of users…"

O modo Conectar calcula, **no navegador do próprio usuário**:
- tendências entre janelas;
- gêneros ponderados;
- contagem de curtidas por artista.

**Impacto:** não é uma vulnerabilidade. O risco é o Spotify revogar o Client ID (ativo 5 do 08). Os modos Upload e Demo não usam a API.

**Atenuantes:**
- Development Mode com até 5 contas convidadas.
- Uso pessoal, sem fins comerciais.
- Nada persistido no servidor.
- Sem perfilamento para publicidade.
- Os dados só aparecem para o próprio titular.

**Decisão pedida ao cliente:**
- (a) aceitar o risco no MVP, como está; ou
- (b) reduzir o Conectar aos dados "como vieram": tops, recentes e curtidas, sem tendências, gêneros ponderados nem contagem.

Recomendação: (a) enquanto o app for pessoal e em Development Mode, reavaliando antes de qualquer pedido de Extended Quota.

### S7-04 — Next.js 16.3.7 (externo) — aberto, bloqueia o go-live

**Evidências:**
- O [aviso prévio](https://nextjs.org/blog/upcoming-nextjs-security-release-september-2026) (23/09) anuncia para **30/09/2026** a 16.3.7 e a 15.5.27.
- São 9 vulnerabilidades: 1 crítica, 2 altas, 5 médias e 1 baixa. Detalhes só no dia.
- A 16.3.6, instalada, é a `latest` e já tem todas as correções publicadas da linha 16. Entre elas, as que atingiam este tipo de app:
  - bypass de proxy com Turbopack e locale único (CVE-2026-64642);
  - XSS com nonce de CSP (CVE-2026-44581);
  - RCE no Windows (CVE-2026-75604);
  - RCE do `next/og` (GHSA-vcvr-r3jv-pc5j).

**Ação no dia 30/09:**
1. Adicionar `- next@16.3.7` e `- eslint-config-next@16.3.7` em `minimumReleaseAgeExclude` no `pnpm-workspace.yaml`. Sem isso, o `minimumReleaseAge` de 24 h barra a instalação.
2. Rodar `pnpm up next@16.3.7 eslint-config-next@16.3.7`.
3. Rodar a suíte completa e ler as advisories: se alguma exigir mitigação no app, aplicar.
4. Remover a exceção depois.

**Gate:** a S8 **não** faz o go-live com Next < 16.3.7.

### S7-05 — Rotas `/api/*` sem CSP nem CORP (Baixo) — corrigido

**Evidência:** `curl -I /api/health` e `/api/spotify/me` voltavam sem `Content-Security-Policy`, porque o `proxy.ts` exclui `/api`.

**Impacto:**
- Uma resposta JSON aberta direto no navegador não tinha política.
- Outro site podia referenciar `/api/*` em `<img>`/`<script>`. A leitura já é bloqueada por `nosniff`/CORB e o cookie é `Lax`, então o impacto é baixo.

**Correção:** `apiSecurityHeaders` em `src/server/security-headers.ts`, aplicado em `next.config.ts` para `/api/:path*`:
- `Content-Security-Policy: default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'`;
- `Cross-Origin-Resource-Policy: same-origin`.

**Testes:**
- `security-headers.test.ts`;
- `e2e/connect.spec.ts` confere os dois cabeçalhos nas 7 rotas.

### S7-06 — Corpo do upstream sem limite em streaming (Baixo) — corrigido

**Local:** `src/server/upstream.ts`. Antes, `await response.text()` e depois `text.length > 2 MiB`.

**Impacto:**
- Uma resposta em chunks, sem `Content-Length`, seria guardada inteira na memória da função antes do teste.
- A comparação era por caracteres, não por bytes.
- Para explorar, é preciso controlar ou adulterar a resposta do Spotify (PR:H).

**Correção:** `readLimitedText()` lê o corpo em streaming e aborta no primeiro byte acima de 2 MiB (`UPSTREAM`/`body_too_large`). Decodifica UTF-8 no fim.

**Testes:** `upstream.test.ts`:
- corpo sem fim → erro depois de ≤ 8 pedaços de 512 KiB;
- UTF-8 dividido entre pedaços.

### S7-07 — Violações de CSP silenciosas (Baixo) — corrigido

**Evidência:**
- No Chromium, o evento `securitypolicyviolation` disparava 3× `script-src eval` por carregamento (páginas e workers).
- A origem é a sonda `new Function('')` do Zod 4 (`allowsEval` em `zod/v4/core/util.js`). O Zod captura o erro, então nada quebra.
- O e2e ("nenhuma página viola a CSP") não via, porque só lia mensagens de console.

**Impacto:**
- Ruído que mascararia uma violação real num futuro `report-to`.
- O teste de CSP estava mais fraco do que parecia.

**Correção:**
- `src/domain/zod-config.ts` (`z.config({ jitless: true })`), importado pelos 3 módulos de schema do domínio.
- `e2e/support.ts` também registra o evento `securitypolicyviolation`.

**Reteste:** 0 violações. 108/108 no e2e com o coletor novo.

**Teste:** `src/domain/zod-config.test.ts`.

### S7-08 — `worker-src blob:` desnecessário (Baixo) — corrigido

Os dois workers (upload e cards) carregam de `/_next/static/chunks/turbopack-worker-*.js`, conferido no Playwright. `blob:` só ampliava a superfície. A política agora é `worker-src 'self'`.

**Testes:** `security-headers.test.ts` e `e2e/home.spec.ts`.

### S7-09 — `NEXT_PUBLIC_REPO_URL` com qualquer esquema (Baixo) — corrigido

O valor vira `href` no rodapé, no selo, na privacidade e no erro de upload. `z.url()` aceitava `javascript:`. A variável agora só aceita `https://`.

**Teste:** `env.test.ts`, com `javascript:`, `http:` e `data:` recusados.

### S7-10 — Segredo público dos e2e aceito em deploy (Baixo) — corrigido

`e2e-only-not-a-secret-000000000000000000000` está versionado em `playwright.config.ts` e tem o formato válido.

**Correção:** `PUBLIC_TEST_SESSION_SECRET` em `env.ts`. Esse valor é recusado em `SESSION_SECRET`/`SESSION_SECRET_PREVIOUS` quando `VERCEL_ENV` é `preview` ou `production`.

**Teste:** `env.test.ts`.

### S7-11 — Lint anti-rede incompleto (Baixo) — corrigido

**Antes:**
- `no-restricted-globals` cobria só `src/domain`, `src/workers` e parte dos cards.
- `window.fetch(...)` e `globalThis.fetch(...)` escapavam da regra.

**Correção (`eslint.config.mjs`):**
- A regra de rede passa a valer também em `src/features/{upload,dataset,dashboard,demo,onboarding,landing}`.
- `no-restricted-properties` proíbe `window|self|globalThis` combinados com `fetch`, `XMLHttpRequest`, `WebSocket`, `EventSource`, `importScripts`, `localStorage` e `indexedDB`.
- `localStorage` e `indexedDB` ficam proibidos em todo o código de produção. Os testes podem conferir que estão vazios.

**Reteste:** um arquivo de prova com 9 usos proibidos gerou 9 erros; o arquivo foi removido depois.

### S7-12 — Sessão sem estado (Baixo) — risco aceito

**Evidência:** um cookie capturado antes do logout continuou respondendo 200 depois do `POST /api/auth/logout` (pentest, bloco 6).

**Por que aceitar:**
- A arquitetura sem banco (ADR 2) não tem onde revogar sessões.
- Roubar o cookie exige acesso ao aparelho ou ao navegador: HttpOnly, `__Host-`, `Secure` e CSP estrita afastam XSS.

**Mitigações existentes:**
- teto absoluto de 30 d;
- remover o app em spotify.com/account/apps mata o refresh token, e o access token dura ≤ 1 h;
- trocar o `SESSION_SECRET` derruba todas as sessões (08, resposta a incidentes).

### S7-13 — Sem rate limiting no BFF (Baixo) — risco aceito

Nenhuma requisição sem sessão válida chega ao Spotify:
- `login` só sela um cookie;
- `callback` sem o cookie temporário recusa antes da troca;
- as rotas `/api/spotify/*` exigem sessão.

Não há amplificação anônima. O abuso autenticado gasta só a quota do próprio app, com até 5 contas.

**Recomendação para a S8:** uma regra de rate limit no Vercel Firewall para `/api/*`, se o plano permitir.

### S7-14 — `code` do OAuth nos logs da plataforma (Baixo) — risco aceito

O app nunca loga a query, mas os logs de requisição da Vercel guardam o caminho com a query do callback.

O `code` sozinho não serve:
- é de uso único;
- expira em minutos;
- exige o `code_verifier`, que só existe no cookie HttpOnly selado;
- exige o client secret.

A página de privacidade agora menciona os logs da plataforma.

## 5. Informativos (sem ação obrigatória)

| Tema | Observação |
|---|---|
| `TRACE` | Qualquer rota responde 500 `Internal Server Error` em texto puro: o undici não suporta o método. O stack vai só para o log do servidor, nunca ao cliente. Na Vercel, a borda deve recusar antes |
| 404 de caminho com ponto | Ex.: `/pt-BR/x.y`, que fica fora do matcher do `proxy.ts` e sai sem CSP. A página é estática e não reflete a URL, e `X-Frame-Options: DENY` está presente. O 404 comum é pré-renderizado sem nonce, então o JS dele é bloqueado pela CSP. Falha fechada, mas a S8 pode fazer um `not-found` localizado |
| Fonte dos workers publicada | O Turbopack publica `/_next/static/media/{card,history}.worker.*.ts` com o código-fonte TypeScript das entradas dos workers (só imports e comentários; o repositório é pensado para ser público). O servidor manda `Content-Type: video/mp2t`, então o navegador nunca executa. Os workers de verdade são os `turbopack-worker-*.js` |
| Cookie `NEXT_LOCALE` | O next-intl grava a preferência de idioma (`Lax`, sessão, sem `Secure`). Não é sensível e a página de privacidade menciona |
| HSTS `preload` | Com domínio próprio, `includeSubDomains; preload` obriga HTTPS em todos os subdomínios. No `*.vercel.app` já vale |
| 403 → `NOT_ALLOWLISTED` | Qualquer 403 do Spotify vira a mensagem da allowlist. Com os escopos fixos, a outra causa conhecida é o dono do app sem Premium (regra de fev/2026 do Development Mode). Questão de UX; a S8 pode citar o caso na mensagem |
| Refresh paralelo | `invalid_grant` só é tolerado com o access token ainda válido (> 5 s); não ganha nada além do que a própria sessão já tem. Revisado e mantido |
| `get-nonce` | O nonce lido de `.nonce` já é acessível a qualquer script da página. Só o `react-style-singleton` o usa, com CSS estático do scroll lock. Mantido |
| Aliases do Turbopack | `harfbuzzjs` → `harfbuzz-browser.ts`, que importa `hb.js`/`hbjs.js` do próprio pacote 0.10.0, com integridade no lockfile. `fs` → módulo vazio, só no browser. Nenhuma origem nova de código. Mantidos |
| Override da fflate | `fflate@<0.7.5 → 0.8.3` corrige o GHSA-px8p-9vwx-vf98 (CVE-2026-45820) na cópia do satori, com a mesma versão já auditada do projeto. Continua necessário |
| satori 0.33.5 | Já é a versão corrigida do GHSA-wx4j-mvgx-mqwp (injeção em SVG). No Encore, o texto vira glifos (path) e o fundo é constante |
| Zip malicioso | Limites revistos e mantidos:<br>• 200 entradas;<br>• 100 MiB por arquivo e 1 GiB no total;<br>• razão 100, medida por entrada e acumulada depois de 1 MiB;<br>• pushes de 16 KiB (saída de no máximo ~16 MiB por push);<br>• nomes com `..`, absolutos, com letra de unidade ou NUL rejeitam o zip inteiro;<br>• entradas que não são histórico nunca são infladas.<br>O pior caso é negar serviço à própria aba de quem envia |
| Capa do card | Allowlist estrita (`https://i.scdn.co/image/<id>`, sem porta, credencial nem query), `credentials: 'omit'`, `no-referrer`, 8 s, ≤ 1 MiB e checagem de bytes JPEG/PNG. O corpo é lido inteiro antes do limite: CDN do Spotify, só na aba do usuário. Aceito |
| XSS | Nenhum `dangerouslySetInnerHTML` (regra `react/no-danger`). Todo metadado passa pelo React. Links e imagens são validados por schema (`open.spotify.com` e CDNs do Spotify) no BFF e de novo no cliente. Nomes de arquivo aparecem só como texto (≤ 200 caracteres) |
| Armazenamento | Conferido no Chromium em demo, card, upload e Conectar: localStorage, IndexedDB e Cache Storage vazios. O sessionStorage só guarda o resultado agregado das curtidas e a pausa de `QUOTA`, com `expiresAt`; é apagado em 401/403/logout. `document.cookie` mostra só `NEXT_LOCALE`: a sessão é HttpOnly |

## 6. O que o pentest confirmou (sem falha)

70 verificações automatizadas, mais os casos via curl:

- **Login:**
  - redirect exato para `/authorize`;
  - PKCE S256;
  - `state` e challenge de 43 caracteres;
  - escopos mínimos;
  - cookie temporário JWE `HttpOnly; SameSite=Lax; Max-Age=600`;
  - `no-store`;
  - `Host` forjado → 307 para a origem configurada;
  - `locale` malicioso (`//evil`, `https://evil`, CRLF) → `pt-BR`, sem cabeçalho injetado.
- **Callback:**
  - sem cookie, `state` diferente ou `state` repetido na query → `error=state`, sem sessão;
  - login CSRF (`code`/`state` do atacante com o cookie da vítima) → `error=state`;
  - replay do callback → `error=oauth`;
  - `Host`/`X-Forwarded-Host` ignorados no destino.
- **Sessão:**
  - JWE `dir`/`A256GCM` com `kid` e `typ`;
  - cookie adulterado → 401 e cookie apagado;
  - cookie do OAuth usado como sessão → 401;
  - `alg=none` → 401;
  - cookie duplicado → 401;
  - `__Host-` em HTTP não autentica;
  - cookie de 15 kB → 401;
  - `Authorization: Bearer` do cliente ignorado;
  - `?access_token=` → 400.
- **Parâmetros:** 24 casos (path traversal no `id`, unicode, `%2F`, offsets negativos, fracionários, hexadecimais, com espaço, fora do múltiplo ou acima do teto, parâmetros repetidos ou desconhecidos, `__proto__`/`constructor`):
  - todos → 400, sem chamar o Spotify;
  - erros com `private, no-store`;
  - sucesso com `private, max-age` e `Vary: Cookie`.
- **Logout (CSRF):**
  - sem `Origin`, de outro site, de outra porta, `null` sem `Sec-Fetch-Site`, `null` com `cross-site`, `same-site`, e `Origin` igual com `Sec-Fetch-Site: cross-site` → 403;
  - `fetch` same-origin → 204 com os 2 cookies apagados e `Clear-Site-Data: "cache"`;
  - formulário → 303 para destino fixo, inclusive com `locale` malicioso.
- **Borda:**
  - `x-middleware-subrequest` (padrão do CVE-2025-29927) não remove a CSP;
  - `RSC: 1` mantém a CSP e o `Vary`;
  - `/_next/image` → 400 (sem `remotePatterns`);
  - `Next-Action` falso → 404 (não há Server Actions);
  - traversal em `/_next/static` e `/fonts` → 404;
  - `/.env.local` e `/.git/config` → 404;
  - o único `.map` publicado é vazio;
  - métodos fora dos declarados → 405; `OPTIONS` → 204 sem cabeçalhos CORS.
- **Segredos:** nenhum no histórico. O único segredo versionado é o de teste dos e2e, agora bloqueado em deploys (S7-10).
- **SCA:** `pnpm audit`: *No known vulnerabilities found*. Nenhuma advisory publicada para as versões exatas (Next 16.3.6, React 19.3.0, jose 6.2.12, satori 0.33.5, resvg-wasm 2.6.2, fflate 0.8.3, next-intl 4.14.6, TanStack Query 5.103.2, Radix 1.6.7, Zod 4.6.5, Comlink 4.4.2, Zustand 5.0.15). Ressalva: o OSV e o GitHub Advisory Database atrasam alguns dias.

## 7. Verificação depois das correções (números reais, Windows, Node 22.20)

| Comando | Resultado |
|---|---|
| `pnpm lint` | 0 erros, 0 warnings |
| `pnpm format:check` | ok |
| `pnpm typecheck` | ok |
| `pnpm test` | **514 testes (41 arquivos)** verdes. Eram 506; os 8 novos cobrem env, upstream, cabeçalhos e Zod |
| `pnpm test:coverage` | Total: 92,99% statements, 88,87% ramos, 94,04% linhas. `src/server`: 97,46%, 95,2% e 99,41%. O limiar de 80% em `src/domain` é aplicado e passa |
| `pnpm build` | ok (Next 16.3.6, Turbopack) |
| `pnpm test:e2e` | **108 testes verdes** (54 por navegador, Chromium e WebKit), agora com o coletor de `securitypolicyviolation`, CSP/CORP do BFF e `worker-src 'self'` |
| `pnpm audit --registry=https://registry.npmjs.org/` | *No known vulnerabilities found* |
| Pentest (script de 70 verificações + curl) | 66/70 no script; as 4 restantes são limitações do `fetch` do Node (cabeçalhos `Host`/`Sec-Fetch-*` proibidos) e foram refeitas com curl, todas aprovadas: 70/70 |
| Chromium: violações de CSP (demo, card, upload, Conectar) | 0 (eram 3 antes do S7-07) |

Como reverificar:
- rode os comandos acima;
- rode os três servidores do README ("E2E do Conectar") e depois:
  - `curl -I http://127.0.0.1:3000/pt-BR`: CSP com `worker-src 'self'`, sem `blob:` nem `wasm-unsafe-eval`;
  - `curl -I http://127.0.0.1:3100/api/spotify/me`: `default-src 'none'` e CORP `same-origin`;
  - `curl -I` num `/_next/static/chunks/turbopack-worker-*.js`: a CSP do worker.

## 8. Conformidade com o Spotify (branding e Developer Terms)

Conferido contra as [Design Guidelines](https://developer.spotify.com/documentation/design), os [Developer Terms](https://developer.spotify.com/terms) (v10) e a [Developer Policy](https://developer.spotify.com/policy):

| Regra | Situação no Encore |
|---|---|
| Nome do app sem "Spotify" nem nada parecido; sem co-branding | ✅ "Encore". O Spotify só aparece de forma descritiva ("suas estatísticas do Spotify"), com o aviso "não é afiliado nem endossado pelo Spotify" no rodapé |
| Atribuição com o logo junto de todo conteúdo da API | ✅ Logo completo oficial (branco, 21 px de altura ≈ 77 px ≥ 70 px) no cabeçalho de toda seção do Conectar e no rodapé dos cards do Conectar |
| Ícone ≥ 21 px; área de proteção ≥ metade da altura do ícone | ✅ 21 px; área ≥ 12 px |
| Cores: verde só sobre preto ou branco; sobre outra cor, monocromático | ✅ Versão branca sobre o fundo escuro (#0e0b1a) |
| Link de volta com o texto padrão | ✅ EN: "Open Spotify" / "Play on Spotify". PT-BR: "Abrir no Spotify" / "Ouvir no Spotify" (localizados). O link é montado a partir do ID validado (`open.spotify.com`) |
| Capa sem corte, sem nada por cima; raio de 4 px (pequena e média) / 8 px (grande) | ✅ `object-fit: contain`, `aspect-ratio: 1`, 4 px ≤ 64 px e 8 px em 96 px |
| Metadado como veio; truncar só com o texto completo acessível | ✅ `line-clamp-2` com o nome completo no `title` e no leitor de tela |
| Sem dado fictício com a marca | ✅ No Demo, nenhum logo e nenhum link do Spotify |
| Mecanismo fácil de desconectar e apagar os dados | ✅ "Sair": apaga o cookie e o cache HTTP (`Clear-Site-Data`), o `queryClient` e o sessionStorage. A privacidade explica como remover o app em spotify.com/account/apps. Nada fica no servidor, então o prazo de 5 dias para apagar dados após a desconexão está cumprido por construção |
| Política de privacidade | ✅ `/privacy` (S7-01) |
| Sem "métricas derivadas" de conteúdo da API | ⚠️ S7-03, decisão do cliente |
| Development Mode | 5 contas na allowlist. A conta dona precisa ter Premium (regra de fev/2026) |

## 9. O que o dono precisa fazer

**GitHub:**
1. **Decidir entre repositório público ou GitHub Code Security.**
   - O selo de privacidade oferece "veja o código", o que pede um repositório público.
   - Com ele público:
     - ligar o CodeQL (Settings → Code security → Code scanning → **Default setup**, linguagem JavaScript/TypeScript, e Actions);
     - o `dependency-review` passa a rodar sozinho nos PRs;
     - o secret scanning e o push protection ficam grátis: ligar os dois.
   - Com ele privado, sem a licença: CodeQL, dependency-review e secret scanning ficam indisponíveis. A SCA fica com o `pnpm audit` do CI e o `security-audit.yml` semanal.
2. **Branch protection / ruleset em `main`:** exigir os jobs `Lint e formatação`, `Tipos`, `Testes…`, `Build`, `E2E…` e `Auditoria de dependências`. Com o repositório público, exigir também `Revisão de dependências do PR` e o CodeQL.
3. **Dependabot:**
   - ligar os alertas e as security updates;
   - conferir em Insights → Dependency graph se o grafo lista as dependências (com o lockfile do pnpm 10, desde a S8.0, deve listar; o dependabot-core#15904 só afetava o lockfile de dois documentos do pnpm 12);
   - o `security-audit.yml` semanal continua como redundância.
4. **Notificações de Actions:** manter o e-mail de "workflow failed" ligado, porque é por ele que o audit semanal avisa.

**Vercel (S8):**
1. `NEXT_PUBLIC_PRIVACY_CONTROLLER` e `NEXT_PUBLIC_PRIVACY_CONTACT`: obrigatórias em produção (S7-01).
2. `SESSION_SECRET` novo, gerado na hora, diferente por ambiente (produção e staging). Nunca o dos e2e: o `env.ts` recusa.
3. Deployment Protection nos previews (já planejado no 09).
4. Se o plano permitir, uma regra de rate limit no Firewall para `/api/*` (S7-13).
5. Domínio próprio: revisar o impacto do HSTS `includeSubDomains; preload` antes de submeter à lista de preload.

**Next.js 16.3.7:** atualizar em 30/09, seguindo os passos de S7-04. O go-live exige ≥ 16.3.7.

**Spotify:** confirmar que a conta dona do app tem Premium. Desde fev/2026, sem Premium o Development Mode para, e tudo vira 403 → "fora da allowlist".

## 10. Decisões pedidas ao cliente

1. **S7-03 (Developer Policy):**
   - (a) aceitar o risco no MVP (recomendado); ou
   - (b) cortar tendências, gêneros ponderados e contagem de curtidas do Conectar.
2. **S7-01 (LGPD):** nome do controlador e e-mail de contato que vão aparecer na página de privacidade.
3. **S7-12 e S7-14:** riscos baixos aceitos pela arquitetura aprovada (ADR 2). Registrados aqui para ciência.

## 11. Recomendações futuras (fora do MVP)

- Relatórios de CSP (`report-to`) num endpoint próprio: sem PII, com amostragem.
- Avaliar `require-trusted-types-for 'script'`. O React 19.3 passou a suportar Trusted Types; exige testar o Next e o Radix.
- ZAP baseline contra o staging na S8.
- Leitura da capa do card em streaming, com o limite aplicado durante o download.
