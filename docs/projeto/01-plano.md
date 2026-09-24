# 01 — Plano: Encore

> Perfil **padrão-leve** · Web fullstack leve (Next.js + BFF mínimo) · **sem banco** · sem IA · Vercel.
> Base: [00-descoberta.md](00-descoberta.md) (aprovada em 2026-09-24). Versões pesquisadas em 2026-09-24.

## Visão
**Encore** é o seu "Wrapped a qualquer hora": estatísticas pessoais de escuta e cards compartilháveis,
com privacidade real. O histórico é processado **no seu dispositivo**, e o servidor não guarda nada.

## Objetivos mensuráveis
1. Três modos funcionando em produção: **Upload** (público), **Conectar** (allowlist ≤ 5) e **Demo**.
2. Um histórico de vários anos (≈ 5 arquivos de 10 MB) processado em **< 10 s** num notebook médio e **< 25 s** num iPhone recente, sem travar a UI.
3. **Zero** dados de escuta ou tokens persistidos no servidor ou em logs, verificado em teste automatizado e na auditoria.
4. Card gerado e compartilhado em **≤ 3 toques** no celular.
5. Lighthouse ≥ 90 (performance e acessibilidade) nas páginas públicas; axe sem violações sérias.
6. CI verde: lint, typecheck, testes (cobertura ≥ 80% no domínio), build, audit e e2e do modo demo.

## Escopo do MVP
- **Entrada:** landing com os 3 modos; onboarding "como pedir seu histórico" (+ lembrete `.ics`); selo de privacidade.
- **Upload:** `.zip` do Spotify (ou JSONs soltos), descompactado e processado em Web Worker com progresso e cancelamento. Filtra podcasts e audiolivros; um play só conta a partir de 30 s.
- **Dashboard de upload e demo:**
  - seletor de período livre;
  - top artistas, músicas e álbuns;
  - minutos e plays;
  - heatmap hora × dia e plataforma mais usada;
  - métricas "você por você": **fã desde**, **% dos seus plays**, **dias diferentes**, **mais pulada**, **dia mais musical**.
- **Dashboard do modo Conectar:**
  - top artistas e músicas nas 3 janelas;
  - tendências em alta e em queda;
  - tocadas recentemente;
  - artista com mais músicas curtidas (varredura sob demanda);
  - gêneros (instável, com degradação graciosa).
- **Cards:** templates **Básico** e **Line-up de festival**, em 9:16 e 1:1. Gerados no navegador (satori + resvg-wasm), com download e Web Share.
- **Plataforma:** i18n PT-BR/EN, responsivo mobile-first, WCAG 2.2 AA, tema escuro "Palco Neon".

## Fora de escopo (agora)
- **Depois:** retrospectiva em slides animados; linha do tempo de "eras" e comparação entre períodos.
- **Recusado:** comparar com amigo; PWA offline.
- **Impossível na API atual:** "top x% dos ouvintes" real; popularidade; audio-features.
- **Recusado por conflitar com "não armazenar":** link público de card; contas próprias; banco de dados; analytics com cookies.

## Premissas
- O autor mantém Spotify Premium e administra a allowlist (≤ 5) no Developer Dashboard.
- `/me/top/*`, `/me/tracks`, `/me/player/recently-played` e `/me` continuam disponíveis em Development Mode.
- O formato do Extended Streaming History continua como hoje (`Streaming_History_Audio_*.json`).
- O refresh token expira 6 meses após a autorização (regra de jun/2026), e o app pede novo login.

## Dependências externas
Spotify Web API e Accounts (OAuth), Vercel (Hobby), GitHub (repo e Actions), Google Fonts (fontes baixadas para o repositório, sem CDN em runtime).

## Glossário
| Termo | Significado |
|---|---|
| **Modo Upload** | Stats a partir do arquivo de histórico, processado 100% no navegador |
| **Modo Conectar** | Stats ao vivo via OAuth do Spotify (allowlist) |
| **Modo Demo** | Dataset fictício, determinístico, sem rede |
| **Play** | Registro de música com `ms_played ≥ 30 000` |
| **Minutos ouvidos** | Soma de `ms_played` de todos os registros de música (inclui plays < 30 s) |
| **Janela** | `short_term` (~4 sem), `medium_term` (~6 m), `long_term` (~1 ano) da API |
| **Dataset** | Estrutura colunar em memória produzida pelo worker a partir do histórico |
| **Card** | Imagem PNG gerada no cliente para compartilhar |
| **BFF** | Route Handlers do Next que fazem OAuth e proxy mínimo para a API do Spotify |

## Riscos e mitigação
| Risco | Prob. | Impacto | Mitigação |
|---|---|---|---|
| Spotify remove `genres` | Alta | Médio | Seção escondida com < 3 gêneros; nada depende dele |
| Quota compartilhada esgota (`QUOTA_EXCEEDED`) | Média | Médio | TTLs longos, varredura de curtidas só sob demanda, pausa de 15 min, mensagem honesta |
| Memória no iOS ao processar histórico grande | Média | Alto | Um arquivo por vez, dataset colunar em TypedArrays, testes em aparelho real |
| Mudança no formato do export | Baixa | Alto | Validação tolerante (Zod por registro, aborta só com > 5% inválidos), mensagem clara |
| Revogação do Client ID por descumprir branding | Baixa | Alto | Checklist de branding na sprint de design e na auditoria |
| XSS roubando sessão | Baixa | Alto | Tokens só em cookie HttpOnly (JWE), CSP com nonce e `strict-dynamic` |
| CDN servindo dados de um usuário para outro | Baixa | Crítico | `Cache-Control: private` + `Vary: Cookie`, proibido `s-maxage`, teste automatizado |
| Vulnerabilidade no Next.js | Média | Médio | Versão fixada, Dependabot, acompanhar security releases |
| Web Share indisponível (Firefox, Linux) | Alta | Baixo | Fallback para download |

## Índice
- [02-requisitos.md](02-requisitos.md): requisitos funcionais e não funcionais
- [03-arquitetura.md](03-arquitetura.md): stack, componentes, modelo de dados em memória, cache, ADRs
- `04-banco-de-dados.md`: **não se aplica** (sem persistência; o modelo em memória está em 03)
- [05-sprints.md](05-sprints.md): roadmap e Definição de Pronto
- [06-user-stories.md](06-user-stories.md): user stories, fluxos e UAT
- [07-estrategia-de-testes.md](07-estrategia-de-testes.md)
- [08-seguranca.md](08-seguranca.md)
- [09-operacao-e-deploy.md](09-operacao-e-deploy.md)
- `10-design.md`: a produzir pelo designer (Sprint 3)
- [PADROES.md](PADROES.md) · [PROGRESSO.md](PROGRESSO.md)
