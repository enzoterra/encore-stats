# src/domain

Lógica de domínio **pura** (sem React, sem DOM, sem rede), testável em Node. Cobertura mínima
de 80% (linhas e ramos). A regra de lint bloqueia `fetch`/`XMLHttpRequest`/`WebSocket` e
armazenamento aqui e em `src/workers`.

| Módulo             | O quê                                                                                    |
| ------------------ | ---------------------------------------------------------------------------------------- |
| `history/`         | Schema Zod do registro, predicado "é música", unzip em streaming com limites, Dataset    |
| `stats/`           | `computeStats(dataset, period, tz)`: totais, tops, heatmap, plataformas, "você por você" |
| `api-stats/`       | Tendências entre janelas, gêneros ponderados, contador incremental de curtidas           |
| `demo/`            | Gerador determinístico (seed fixa) do Dataset e das respostas fictícias da API           |
| `spotify-types.ts` | Schemas Zod das respostas reduzidas do BFF                                               |
| `time.ts`          | Fuso horário (IANA como parâmetro) e índice local memorizado por Dataset                 |

Regras de negócio (detalhes nos comentários de cada função):

- **Música**: `spotify_track_uri` e nome da faixa preenchidos, campos de episódio e de
  audiolivro vazios. Faixas locais (sem URI) ficam de fora.
- **Play**: `ms_played ≥ 30 s`. **Minutos**: soma de `ms_played` de toda música do período.
- **Pulada**: `skipped === true`; sem `skipped` (registros antigos), `reason_end === 'fwdbtn'`.
- **Arquivo inválido**: mais de 5% de registros inválidos rejeita o arquivo (`INVALID_RECORDS`).
- `ip_addr`, `conn_country` e demais campos não usados são descartados pelo schema.
