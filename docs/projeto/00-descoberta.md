# 00 — Descoberta: spotify-stats ("Wrapped a qualquer hora")

> Data: 2026-09-24 · Conduzida por: analista-de-ideias (com parecer do desenvolvedor-de-ideias)
> Legenda: **[decisão do usuário]** · **[sugestão — a confirmar]** · **[fato pesquisado]**

## Visão e necessidade real
O Spotify Wrapped mostra artistas/músicas mais ouvidos, minutos, "top x% dos ouvintes" etc., mas
**só uma vez por ano**. O usuário quer ver as próprias estatísticas **a qualquer momento**, com mais
métricas do que o Wrapped oferece, e compartilhar cards bonitos — **sem que ninguém armazene os dados
de escuta** (LGPD como princípio, não como detalhe).

Necessidade de fundo (JTBD): *"quero me reconhecer no meu gosto musical e mostrar isso aos outros
quando eu quiser, sem abrir mão da minha privacidade"*. Para o autor, há um segundo job: **ter um
projeto de portfólio com código exemplar** que outras pessoas realmente usem.

## Problema raiz e objetivos
- Problema raiz: estatísticas pessoais de escuta são inacessíveis fora da janela do Wrapped, e as
  alternativas (stats.fm, Skiley etc.) exigem entregar o histórico a um servidor de terceiros.
- Objetivos:
  1. Dashboard de stats pessoais sempre disponível, em três modos (upload, API, demo).
  2. Cards compartilháveis gerados no navegador.
  3. **Zero armazenamento de dados de escuta no servidor**; privacidade demonstrável.
  4. Código de qualidade de portfólio (tipado, testado, seguro, documentado).

## Perfil do projeto
**Padrão-leve** **[decisão do usuário: portfólio/estudo + uso real]**
- Justificativa: não é produto comercial nem de missão crítica, mas é portfólio que vai ao ar com
  usuários reais e lida com dados pessoais (OAuth Spotify, histórico de escuta) → testes, CI, segurança
  sólida e README exemplar fazem sentido.
- **Sem Docker** (deploy Vercel; `npm run dev` já reproduz o ambiente), **sem banco**, sem
  observabilidade formal/DR. O "seed demo" do padrão é materializado como **modo demo com dados fictícios**.
- `analista-de-seguranca` **deve** ser acionado (OAuth + dados pessoais).

## Tipo/forma do projeto
**App web fullstack leve** (frontend rico + backend mínimo):
- **Frontend: sim** (dashboard, cards, onboarding) → `designer` + `dev-frontend`.
- **Backend: mínimo** — apenas o fluxo OAuth com o Spotify (troca/refresh de token, sessão em cookie
  seguro) e proxy/cache curto das chamadas à API. Todo o modo upload roda **100% no navegador**.
- **Banco de dados: não** → sem `dev-banco-de-dados`.
- **IA: não** → sem `dev-ia`.
- Infra: Vercel; `analista-de-infra` só para esqueleto, env, CI (pode ser consolidado com o dev).

## Métricas de sucesso
- Autor + 4 amigos usam o modo API; qualquer visitante consegue usar upload e demo.
- Upload de histórico de vários anos (dezenas de MB) processa sem travar a UI (alvo: < 10 s em notebook comum).
- Nenhum dado de escuta persistido no servidor (verificável no código e nos logs).
- Card gerado e compartilhado em ≤ 3 toques no celular.
- Lighthouse ≥ 90 em performance/acessibilidade; CI verde com testes.

## Escopo (MVP priorizado) e fora de escopo
**Must (MVP)**
- Três modos de entrada: **Upload do histórico estendido**, **Conectar com Spotify**, **Demo**.
- Upload: aceitar o **.zip direto** do Spotify, descompactar e processar em **Web Worker** com barra
  de progresso; filtrar podcasts/audiolivros; contar play só > 30 s.
- Stats (upload): top artistas/músicas/álbuns, minutos ouvidos, plays, **seletor de período livre**
  (mês, ano, desde sempre, intervalo), **heatmap hora × dia da semana**, plataforma mais usada,
  **métricas substitutas do "top x%"** (ver Funcionalidades).
- Stats (API): top artistas e músicas nas 3 janelas (~4 sem, ~6 m, ~1 ano), tocadas recentemente,
  **artista com mais músicas curtidas (e quantas)**, **gêneros mais escutados** (marcado como instável),
  **tendências em alta/em queda** cruzando as janelas.
- Cards compartilháveis como imagem (9:16 Stories e 1:1): template básico + **template "line-up de
  festival"**; download e **Web Share API** no celular.
- **Prova de privacidade** visível (selo, link para o repositório, "funciona offline após carregar").
- **Onboarding da espera**: passo a passo para pedir o histórico (pode levar até ~30 dias), com CTA
  para demo/conectar enquanto isso.
- i18n **PT-BR + EN**; responsivo; acessível.

**Should / Could (depois do MVP)** **[decisão do usuário]**
- Retrospectiva em slides animados (estilo Stories).
- Linha do tempo de "eras" (artista nº 1 por mês/ano) + comparação "este período vs anterior".

**Won't (recusado agora)** **[decisão do usuário]**
- Comparar compatibilidade com amigo (via link/fragment) — recusado por ora.
- PWA instalável/offline completo — recusado por ora (o "funciona offline após carregar" do selo continua).
- "Top x% dos ouvintes" real, obscuridade/mainstream score, vibe/energia — **impossíveis** na API atual.
- Link público de card (exigiria armazenar snapshot) — recusado em favor de imagem baixável.
- Qualquer banco de dados/contas próprias do app.

## Usuários e papéis
- **Visitante anônimo**: usa demo e upload (sem login). Público aberto.
- **Usuário conectado (allowlist)**: autor + até 4 amigos cadastrados manualmente no Spotify
  Developer Dashboard; usa o modo API.
- Sem papéis administrativos no app. Gestão da allowlist é feita no dashboard do Spotify.
- Uso esporádico (curiosidade, "como está meu mês?"), majoritariamente no celular para compartilhar.

## Funcionalidades
| Área | Upload | API | Demo |
|---|---|---|---|
| Top artistas / músicas | ✅ (qualquer período) | ✅ (3 janelas) | ✅ |
| Top álbuns | ✅ | derivado das top tracks | ✅ |
| Minutos ouvidos / plays / skips | ✅ | ❌ | ✅ |
| Artista com mais músicas curtidas | ❌ | ✅ (`/me/tracks`) | ✅ |
| Gêneros | ❌ (JSON não traz) | ✅ ⚠️ deprecated | ✅ |
| Heatmap hora × dia, plataforma | ✅ | ❌ | ✅ |
| Tendências em alta/queda | (via período) | ✅ | ✅ |
| Tocadas recentemente | — | ✅ (50) | ✅ |
| Cards (básico + festival) | ✅ | ✅ | ✅ |

**Substitutos honestos do "top x%"** (comparação consigo mesmo, rotulada como tal): "fã desde" (1º play),
"% dos seus plays foram de X", "ouviu X em N dias diferentes", música que você mais pula, "seu dia mais
musical". Escolher 2–3 no MVP (planejamento define).

## Domínio e referências
- **stats.fm**: importa histórico estendido, contagem exata de plays — mas armazena no servidor.
- **Skiley**: stats + gestão de playlists, aberto ao público porque obteve Extended Quota **antes** da
  regra de mai/2025 **[fato pesquisado]** — modelo não replicável para app novo.
- **Receiptify / Instafest**: cards de template único que viralizam → inspiração para os cards.
- **Obscurify / "how bad is your spotify"**: dependiam de `popularity`/`audio-features` (removidos).
- Diferencial deste projeto: **privacidade real — processamento no dispositivo**.

## Dados e sensibilidade
- Dados tratados: histórico de escuta (pessoal, revela hábitos — tratar como PII), perfil básico do
  Spotify, tokens OAuth.
- **Nada de dados de escuta persistido no servidor.** Modo upload: arquivo nunca sai do navegador.
  Modo API: dados trafegam pelo backend (ou direto do navegador — decisão do plano) e ficam só em
  **cache curto** (memória/sessão do navegador e/ou cache HTTP privado), sem logs de conteúdo.
- Tokens: em cookie `HttpOnly`/`Secure`/`SameSite`, criptografado, expiração curta; logout apaga.
- LGPD: página de privacidade clara; base legal = execução do serviço solicitado pelo titular;
  sem compartilhamento com terceiros; sem analytics invasivo (se houver, sem cookies/PII).

## Requisitos de segurança
- OAuth 2.0 Authorization Code **com PKCE**, `state` anti-CSRF, escopos mínimos
  (`user-top-read`, `user-read-recently-played`, `user-library-read`, possivelmente `playlist-read-private`).
- Client secret só no servidor (se usado); nenhum segredo no repositório.
- Cabeçalhos: CSP estrita, HSTS, X-Content-Type-Options, frame-ancestors none.
- Validação do conteúdo do upload (schema, limites de tamanho, zip-bomb) — mesmo sendo local.
- Tratamento de 429 (rate limit e `QUOTA_EXCEEDED` — quota compartilhada por conta de dev).
- Dependências auditadas; sprint de segurança com `analista-de-seguranca`.

## Integrações
- **Spotify Web API** (Development Mode, até 5 usuários; dono tem Premium **[confirmado pelo usuário]**).
- **Spotify Extended Streaming History** (arquivo .zip/JSON fornecido pelo usuário).
- Atribuição obrigatória: logo/link do Spotify onde exibir dados/capas vindos da API; cards com
  identidade própria e atribuição discreta ("dados: Spotify") **[fato pesquisado — termos]**.
- Opcional: oEmbed público do Spotify para capas no modo upload **[sugestão — a confirmar no plano]**.

## Infraestrutura
- **Vercel** **[decisão do usuário]**, plano gratuito; deploy automático a partir do GitHub.
- Sem banco, sem Docker. Config por variáveis de ambiente + `.env.example`.
- CI no GitHub Actions: lint, typecheck, testes, build, audit **[sugestão]**.

## Design e identidade visual
- **Estilo "Wrapped"** **[decisão do usuário]**: cores vibrantes, tipografia grande e bold, cards
  chamativos, animações sutis. **Sem** imitar logo/marca/verde do Spotify nem a identidade oficial
  do Wrapped. Nome do produto próprio (não usar "Wrapped" no nome) **[sugestão]**.
- Tema escuro como base, com possibilidade de claro **[sugestão]**.
- Cards do modo upload: visual tipográfico (sem capa), coerente com a identidade bold.

## Plataforma e responsividade
- Web responsiva, **mobile-first** (compartilhamento acontece no celular).
- i18n **PT-BR + EN** desde o início **[decisão do usuário]**.
- Acessibilidade WCAG 2.2 AA (contraste mesmo com cores vibrantes, navegação por teclado, gráficos com alternativa textual).

## Restrições críticas / o que não pode falhar
- **Não pode vazar nem persistir** dados de escuta ou tokens (inaceitável).
- Upload grande não pode travar/crashar o navegador.
- Limites da API: 5 usuários, quota compartilhada por conta, 429 tratado com elegância.
- `genres` pode desaparecer a qualquer momento → a UI deve degradar sem quebrar.
- Cumprir os termos/branding do Spotify (risco de revogação do Client ID).

## Nível técnico do usuário
Desenvolvedor; sem preferência de stack → o planejamento recomenda (provável Next.js + TypeScript).

## Premissas
- O autor mantém Spotify Premium e gerencia a allowlist manualmente.
- O formato do Extended Streaming History permanece como hoje (JSONs `Streaming_History_Audio_*.json`
  com `ts`, `ms_played`, `master_metadata_*`, `platform`, `skipped`, `reason_start/end` etc.).
- Os endpoints `/me/top/*`, `/me/tracks`, `/me/player/recently-played` seguem disponíveis em Development Mode.

## Ideias e oportunidades sugeridas
| Ideia | Status |
|---|---|
| Aceitar ZIP direto + Web Worker + regra 30 s | ✅ aceita (MVP) |
| Prova de privacidade visível | ✅ aceita (MVP) |
| Onboarding da espera (+ lembrete .ics opcional) | ✅ aceita (MVP; .ics a confirmar no plano) |
| Tendências em alta/queda (API) | ✅ aceita (MVP) |
| Seletor de período livre | ✅ aceita (MVP) |
| Substitutos honestos do "top x%" | ✅ aceita (MVP, 2–3 métricas) |
| Heatmap de escuta + plataforma | ✅ aceita (MVP) |
| Card "line-up de festival" + Web Share | ✅ aceita (MVP) |
| Retrospectiva em slides animados | ⏭️ aceita para depois |
| Eras + comparação de períodos | ⏭️ aceita para depois |
| Comparar com amigo sem servidor | ❌ recusada por ora |
| PWA offline | ❌ recusada por ora |

## Decisões sugeridas a confirmar
- Stack: Next.js (App Router) + TypeScript + Tailwind; gráficos com lib leve; geração de imagem de card
  no navegador (ex.: html-to-image/canvas) — versões a pesquisar no plano.
- Chamadas à API pelo backend (BFF com token em cookie HttpOnly) **vs.** direto do navegador com PKCE
  puro — recomendação preliminar: BFF (tokens fora do JS; cache HTTP privado curto).
- Estratégia de cache: TTL por endpoint (ex.: top items ~1 h, curtidas ~1 h, recently-played ~1–2 min),
  guardado só no navegador (memória/sessionStorage) e/ou `Cache-Control: private`.
- Nome próprio do produto.
- Uso de oEmbed para capas no modo upload.

> **Fechado no planejamento (2026-09-24):**
> - **[decisão do usuário]** Next.js + BFF; visual "Palco Neon"; nome **Encore**; métricas: fã desde, % dos plays, dias diferentes, mais pulada, dia mais musical.
> - Analytics: nenhum.
> - Capas no upload: não (cards tipográficos).
> - Detalhes técnicos em `03-arquitetura.md`.

## Perguntas-chave em aberto
- Quais 2–3 métricas substitutas do "top x%" entram primeiro? (planejamento propõe)
- Nome/marca do produto.
- Se haverá analytics (e qual, sem cookies) — default: nenhum.
