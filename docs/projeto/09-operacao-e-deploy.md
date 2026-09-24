# 09 — Operação e deploy (proporcional ao porte)

## Ambientes
| Ambiente | Onde | Conectar | Observação |
|---|---|---|---|
| Local | `pnpm dev` em `http://127.0.0.1:3000` (não `localhost`: o Spotify exige IP de loopback literal) | Sim, com `.env.local` | Sem credenciais: Upload + Demo |
| Staging | Branch `staging`, URL fixa do branch na Vercel | Sim (URI cadastrada) | Deployment Protection ligada |
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
- **Rollback:** "Instant Rollback" / promover o deployment anterior no painel, que leva segundos. Sem migrações, o rollback é trivial.

## Observabilidade (mínima)
- **Runtime logs da Vercel** (retenção de 1 h no Hobby), apenas com o logger de allowlist.
- **Endpoint `GET /api/health`** respondendo `{status:"ok"}`.
- **Sem analytics** no MVP. Se for adotado no futuro, usar Vercel Web Analytics, que não usa cookies, e atualizar a página de privacidade.
- **Sem SLO formal, DR ou IaC**: porte pessoal, sem estado para recuperar.

## Checklist de go-live
- [ ] App criado no Spotify Developer Dashboard, com nome "Encore" e redirect URIs de produção, staging e 127.0.0.1
- [ ] Allowlist com o autor + até 4 usuários
- [ ] Env vars de produção na Vercel: `SESSION_SECRET` gerado com 32 bytes aleatórios e diferente de staging
- [ ] Cabeçalhos verificados em produção (securityheaders.com ou `curl -I`)
- [ ] Relatório de segurança sem alta/crítica
- [ ] Lighthouse ≥ 90; e2e verde contra staging
- [ ] Página de privacidade publicada; link do repositório no selo
- [ ] Rollback conhecido (deployment anterior identificado)
- [ ] UAT aprovado pelo cliente
