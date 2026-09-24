# 02 — Requisitos

## Funcionais
| ID | Requisito | Prior. | US |
|---|---|---|---|
| RF-01 | A landing apresenta os 3 modos (Upload, Conectar, Demo) e o selo de privacidade | Must | US-01 |
| RF-02 | Onboarding passo a passo para pedir o Extended Streaming History, avisando da espera de até ~30 dias. Oferece demo e conectar enquanto isso, e baixa um lembrete `.ics` gerado no cliente | Must | US-02 |
| RF-03 | Aceitar `.zip` do Spotify ou `Streaming_History_Audio_*.json` soltos, por arrastar ou selecionar | Must | US-03 |
| RF-04 | Processar em Web Worker com progresso por etapa (descompactar, ler, agregar) e botão de cancelar | Must | US-03 |
| RF-05 | Validar registros e o zip: rejeitar entradas estranhas, zip-bomb e arquivos acima dos limites, com mensagens de erro claras | Must | US-03 |
| RF-06 | Excluir podcasts e audiolivros; contar play só com `ms_played ≥ 30 s`; minutos = soma de `ms_played` de música | Must | US-04 |
| RF-07 | Seletor de período: mês, ano, desde sempre e intervalo personalizado | Must | US-04 |
| RF-08 | Top artistas, músicas e álbuns do período (por plays, com minutos) | Must | US-04 |
| RF-09 | Totais do período: minutos, plays, artistas e músicas distintos | Must | US-04 |
| RF-10 | Heatmap hora × dia da semana (fuso local), com tabela equivalente acessível; plataforma mais usada | Must | US-05 |
| RF-11 | Métricas "você por você": fã desde, % dos seus plays, dias diferentes, música mais pulada, dia mais musical. Rotuladas como comparação consigo mesmo | Must | US-06 |
| RF-12 | Modo Demo com dataset fictício determinístico, cobrindo os dashboards de upload e de conectar, sem rede | Must | US-07 |
| RF-13 | Login OAuth com o Spotify (Authorization Code + PKCE, `state`) e logout que apaga cookie e cache | Must | US-08 |
| RF-14 | Mensagem clara quando o usuário não está na allowlist (403 do Spotify) | Must | US-08 |
| RF-15 | Modo Conectar: top artistas e músicas nas 3 janelas | Must | US-09 |
| RF-16 | Tendências em alta e em queda cruzando as janelas (entrou, subiu, caiu, saiu) | Must | US-09 |
| RF-17 | Tocadas recentemente (últimas 50) | Must | US-09 |
| RF-18 | Artista com mais músicas curtidas e quantas, via varredura sob demanda de `/me/tracks` com progresso e cancelamento | Must | US-10 |
| RF-19 | Gêneros mais escutados, ponderados pelo rank de `/me/top/artists`. Seção escondida se houver menos de 3 gêneros | Must | US-09 |
| RF-20 | Cards em 2 templates (Básico, Line-up de festival) × 2 formatos (9:16, 1:1), com prévia | Must | US-11 |
| RF-21 | Compartilhar pela Web Share API com arquivo quando suportado; caso contrário, download PNG | Must | US-11 |
| RF-22 | Atribuição do Spotify (logo e link "Abrir no Spotify") onde houver metadados vindos da API, inclusive nos cards | Must | US-09, US-11 |
| RF-23 | Troca de idioma PT-BR/EN; detecção inicial pelo navegador | Must | US-12 |
| RF-24 | Página de privacidade (LGPD): o que é tratado, onde, por quanto tempo e como revogar o acesso | Must | US-13 |
| RF-25 | Tratamento de limites da API: 429 com espera e `QUOTA_EXCEEDED` com pausa e mensagem | Must | US-09 |
| RF-26 | Retrospectiva em slides animados | Could (depois) | — |
| RF-27 | Eras (artista nº 1 por mês/ano) e comparação entre períodos | Could (depois) | — |

## Não funcionais
| ID | Categoria | Requisito (mensurável) |
|---|---|---|
| RNF-01 | Privacidade/LGPD | Nenhum dado de escuta, perfil ou token é persistido no servidor nem registrado em log. Upload nunca sai do navegador (sem `fetch` com o conteúdo, verificado em teste e2e com interceptação de rede). Cache só em memória ou sessionStorage, limpo no logout. `ip_addr` e `conn_country` descartados no parse |
| RNF-02 | Segurança | Tokens em cookie JWE (A256GCM) `HttpOnly; Secure; SameSite=Lax`. CSP com nonce e `strict-dynamic`, HSTS, `nosniff`, `frame-ancestors 'none'`, `Referrer-Policy: no-referrer`. Zero vulnerabilidade alta ou crítica (audit/CodeQL) |
| RNF-03 | Desempenho | Processamento de upload: < 10 s (desktop) e < 25 s (iPhone recente) para ~50 MB de JSON. Troca de período < 200 ms. Lighthouse ≥ 90 nas páginas públicas. satori/resvg carregados só na tela de cards |
| RNF-04 | Memória | Pico < 300 MB no iOS com histórico de ~50 MB: um arquivo por vez, dataset colunar |
| RNF-05 | Resiliência | Chamadas ao Spotify com timeout de 10 s; retry só em 429/5xx (máx. 2, respeitando `Retry-After`, teto de 30 s). `invalid_grant` leva a novo login. Falha de uma seção não derruba o dashboard |
| RNF-06 | Cache | TTLs por endpoint (ver 03). `Cache-Control: private, max-age=N` + `Vary: Cookie`; `s-maxage` e `public` proibidos nas rotas `/api/spotify/*` |
| RNF-07 | Acessibilidade | WCAG 2.2 AA: contraste ≥ 4,5:1 no texto normal, foco visível, navegação por teclado, gráficos com alternativa textual, `prefers-reduced-motion` |
| RNF-08 | Responsividade | Mobile-first de 360 px a 1440 px ou mais, sem scroll horizontal |
| RNF-09 | i18n | PT-BR e EN com next-intl; números e datas formatados por locale |
| RNF-10 | Manutenibilidade | TypeScript `strict`, ESLint sem warnings, cobertura ≥ 80% em `src/domain` e 100% nos caminhos de segurança do BFF |
| RNF-11 | Observabilidade | Logs estruturados com allowlist de campos (rota, status, duração, código de erro), sem corpo, token, `code` ou query do callback |
| RNF-12 | Custo | R$ 0/mês (Vercel Hobby, GitHub grátis). Domínio opcional |
| RNF-13 | Conformidade Spotify | Cumprir Developer Terms e Design Guidelines: atribuição, capas sem corte ou sobreposição, nome sem "Spotify" ou "Wrapped" |
