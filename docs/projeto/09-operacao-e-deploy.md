# 09 — Operação e deploy (proporcional ao porte)

## Ambientes
| Ambiente | Onde | Conectar | Observação |
|---|---|---|---|
| Local | `pnpm dev` em `http://127.0.0.1:3000` (não `localhost`: o Spotify exige IP de loopback literal) | Sim, com `.env.local` | Sem credenciais: Upload + Demo |
| Staging | Branch `staging`, URL fixa do branch na Vercel (`<projeto>-git-staging-<escopo>.vercel.app`) | Sim (URI cadastrada; variáveis no escopo _Preview_ do branch) | Deployment Protection ligada |
| Previews (PRs) | URLs dinâmicas | **Não** (sem redirect URI; botão desabilitado) | Upload + Demo |
| Produção | `encore-<scope>.vercel.app` (domínio próprio opcional) | Sim | Env vars só de produção |

## Ambiente local com "seed demo"
Não há banco. O **modo Demo** é o seed: um gerador determinístico que o app carrega sem configuração nenhuma.

Passo a passo:
1. `git clone` e `pnpm i`
2. `cp .env.example .env.local`, que pode ficar vazio para usar Upload e Demo
3. `pnpm dev` e abrir `http://127.0.0.1:3000`, entrando no Demo

Credenciais demo: **não se aplicam**, porque o Demo não exige login. Para testar o Conectar localmente é preciso ter um app próprio no Spotify Developer Dashboard e a sua conta na allowlist (o README explica como).

## CI/CD
- **CI:** GitHub Actions a cada PR ou push (gates em 07).
- **CD:** integração Git da Vercel.
  - PR vira preview;
  - `staging` vira staging;
  - `main` vira produção.
- **Promoção:** merge em `main` só com CI verde (branch protection).

## Deploy e rollback
- O deploy é atômico e imutável na Vercel.
- **Rollback:** "Instant Rollback" no painel, que leva segundos (no Hobby, só para o deployment de produção imediatamente anterior). Sem migrações, o rollback é trivial. Depois dele, a publicação automática de `main` fica pausada até o "Undo Rollback".
- **Configuração inválida não chega ao ar:** o `next build` valida o ambiente (`next.config.ts` → `src/server/env-schema.ts`); na Vercel, o deploy falha no build e o anterior continua publicado.

## Observabilidade (mínima)
- **Runtime logs da Vercel** (retenção de 1 h no Hobby), apenas com o logger de allowlist.
- **Endpoint `GET /api/health`** respondendo `{status:"ok"}`.
- **Sem analytics** no MVP. Se for adotado no futuro, usar Vercel Web Analytics, que não usa cookies, e atualizar a página de privacidade.
- **Sem SLO formal, DR ou IaC**: porte pessoal, sem estado para recuperar.

## Checklist de go-live
Passo a passo completo no README, seção "Deploy na Vercel".
- [x] Next.js ≥ 16.3.8 (security release de 30/09; aplicado em 2026-10-01). A Vercel também bloqueia por padrão novos deploys de versões vulneráveis do Next
- [ ] Projeto importado na Vercel sem `vercel.json` nem _Override_; log do build com pnpm 10.x e Node 24.x
- [ ] Branch `staging` criado; URL fixa do branch anotada; Deployment Protection (Vercel Authentication, _Standard Protection_) ligada
- [ ] App criado no Spotify Developer Dashboard, com nome "Encore" e redirect URIs de produção, staging (URL fixa do branch) e 127.0.0.1
- [ ] Allowlist com o autor + até 4 usuários; **conta dona do app com Premium**
- [ ] Env vars de produção na Vercel:
  - `NEXT_PUBLIC_SITE_URL` = URL de produção (HTTPS)
  - `NEXT_PUBLIC_PRIVACY_CONTROLLER` = `Enzo Terra` e `NEXT_PUBLIC_PRIVACY_CONTACT` = `enzoterra18@gmail.com` (informados pelo cliente em 2026-09-25; também no `staging`)
  - `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET` (_Sensitive_), `SPOTIFY_REDIRECT_URI` de produção
  - `SESSION_SECRET` gerado com 32 bytes aleatórios, _Sensitive_ e diferente do de staging
- [ ] Env vars do `staging` só no escopo _Preview_ do branch `staging` (nenhuma variável do Spotify em _Preview_ geral)
- [ ] Cabeçalhos verificados em produção (securityheaders.com ou `curl -I`); `/api/health` ok; 404 localizado
- [ ] Relatório de segurança sem alta/crítica
- [ ] Lighthouse ≥ 90; e2e verde contra staging
- [ ] Página de privacidade publicada com controlador e contato; link do repositório no selo
- [ ] Rollback conhecido (deployment anterior identificado; Instant Rollback + Undo Rollback)
- [ ] UAT aprovado pelo cliente
