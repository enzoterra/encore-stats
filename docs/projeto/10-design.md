# 10 — Sistema de design: Encore · "Palco Neon"

> Sprint 3 · designer · 2026-09-24 · **Status: aguardando aprovação do cliente** (direção Palco Neon e nome Encore já aprovados).
> Contrato entre design e `dev-frontend`. Tudo que tem valor aqui é **fixo**; o que não está aqui, pergunte antes de inventar.
>
> Arquivos da sprint (`docs/projeto/design/`):
> - `mockup.html`: dashboard mobile (modo Upload) + prévia do card Festival 9:16. Abra direto no navegador.
> - `cards/templates.mjs`: protótipo dos 4 templates, **validado no satori 0.33.5 + resvg-wasm 2.6.2**.
> - `cards/preview/*.png`: PNGs gerados por esse protótipo, incluindo testes de estresse com nomes longos, cirílico e acentos.
> - `fonts/`: TTF estáticos para o satori, WOFF2 variáveis para a web e as licenças OFL (§13).

---

## 1. Princípios

1. **Palco, não planilha.** O dado é o show: números e nomes grandes, em Bricolage, sobre fundo escuro. Tabelas e textos explicativos ficam em segundo plano.
2. **Texto escuro sobre cor vibrante.** Magenta, amarelo, laranja e ciano são fundos de destaque ou cor de texto sobre o escuro. **Nunca** vai texto claro sobre essas cores (branco sobre magenta dá 3,0:1 e reprova).
3. **Privacidade à vista.** O selo de privacidade faz parte da identidade, não é nota de rodapé. Cada tela diz, sem exagero, onde os dados estão.
4. **Honestidade de dado.** Métricas "você por você" são rotuladas como comparação com o próprio histórico. O que é instável (gêneros) leva selo. O que é fictício (Demo) leva a tag **DEMO**, inclusive nos cards.
5. **Um toque a menos.** Mobile-first. A ação principal (Compartilhar) fica sempre ao alcance do polegar, e cada tela tem um único botão primário.

---

## 2. Cor

### 2.1 Paleta base (tema escuro, único no MVP)
| Token | Hex | Papel |
|---|---|---|
| `neon-magenta` | `#FF3D8B` | Primária: botão primário, destaques, marca |
| `neon-yellow` | `#FFE14D` | Acento: seleção (chips/segmented), ranks 1–3, foco, headliner do festival |
| `neon-orange` | `#FF7A1A` | Apoio: texto de contexto sobre escuro, estatísticas do card |
| `neon-cyan` | `#3DE0FF` | Apoio: rótulos (overline), info, tag DEMO |
| `stage-950` | `#0E0B1A` | Fundo da página (`background`) e "tinta" (`ink`) sobre cores vibrantes |
| `stage-900` | `#17122A` | `surface` (cards, inputs) |
| `stage-850` | `#211A3A` | `surface-2` (itens elevados, segmented, skeleton) |
| `stage-800` | `#2B2248` | `surface-3` (hover de superfície, fundo desabilitado) |
| `stage-700` | `#342A52` | `line`: divisores e bordas decorativas |
| `stage-500` | `#7D71A8` | `line-strong`: borda de input e de controle (componente de UI) |
| `stage-400` | `#968CB8` | `fg-subtle`: legendas e metadados terciários |
| `stage-300` | `#B8AED6` | `fg-muted`: texto secundário |
| `stage-50` | `#F5F1FF` | `fg`: texto principal |

**Por que essas cores.** São as do parecer aprovado. O magenta passa energia e noite de show, e como primária pede ação sem lembrar o verde do Spotify. O amarelo-ácido é a luz de palco e chama o olho para o que está selecionado. O ciano funciona como luz fria para rótulos e informação. O fundo violeta quase preto (`#0E0B1A`) evita o preto puro, que "vibra" com neon no OLED, e dá profundidade.

### 2.2 Tokens semânticos
| Token semântico | Valor | Uso |
|---|---|---|
| `background` | `#0E0B1A` | `body` |
| `surface` / `surface-2` / `surface-3` | `#17122A` / `#211A3A` / `#2B2248` | Níveis de elevação (§5.3) |
| `fg` / `fg-muted` / `fg-subtle` | `#F5F1FF` / `#B8AED6` / `#968CB8` | Texto |
| `line` / `line-strong` | `#342A52` / `#7D71A8` | Borda decorativa / borda funcional |
| `primary` | `#FF3D8B` | Fundo do botão primário, marca |
| `primary-hover` / `primary-active` | `#FF62A2` / `#E82E78` | Estados do primário |
| `primary-fg` (link) | `#FF7AB0` | Links e texto magenta sobre qualquer superfície |
| `on-vibrant` (ink) | `#0E0B1A` | Texto e ícone sobre magenta, amarelo, laranja, ciano e estados |
| `accent` | `#FFE14D` | Selecionado, ranks 1–3 |
| `focus` | `#FFE14D` | Anel de foco |
| `success` | `#52F2C8` | "subiu", concluído (menta, distante do verde Spotify `#1DB954` em matiz e luminosidade) |
| `warning` | `#FFC23D` | 429, espera de ~30 dias, "instável" |
| `danger` | `#FF5A5F` | Erro, "caiu", destrutivo |
| `danger-fg` | `#FF8A8E` | Texto de erro sobre superfícies |
| `info` | `#3DE0FF` | Info, tag DEMO |
| `disabled-bg` / `disabled-fg` | `#2B2248` / `#8A80AA` | Controles desabilitados (isentos de contraste, mas legíveis: 4,03:1) |
| `overlay` | `rgba(8,6,16,0.72)` | Fundo de modal |

### 2.3 Contrastes verificados (WCAG 2.2, fórmula de luminância relativa)
Calculados por script em 2026-09-24. AA exige ≥ 4,5:1 para texto normal, ≥ 3:1 para texto grande (≥ 24 px, ou ≥ 18,66 px em negrito) e para componentes de UI (1.4.11).

| Frente / fundo | Razão | Resultado | Uso permitido |
|---|---|---|---|
| `fg` #F5F1FF / `background` | 17,48 | AAA | todo texto |
| `fg` / `surface` · `surface-2` · `surface-3` | 16,35 · 14,85 · 13,27 | AAA | todo texto |
| `fg-muted` #B8AED6 / `background` · `surface` · `surface-2` · `surface-3` | 9,31 · 8,70 · 7,90 · 7,06 | AAA | texto secundário |
| `fg-subtle` #968CB8 / `background` · `surface` · `surface-2` · `surface-3` | 6,23 · 5,83 · 5,29 · 4,73 | AA | legendas (em `surface-3` a folga é pequena; prefira `fg-muted`) |
| `line-strong` #7D71A8 / `background` · `surface` · `surface-2` | 4,44 · 4,15 · 3,77 | ≥ 3:1 UI | bordas de input e controle |
| ink #0E0B1A / `primary` #FF3D8B | 5,82 | AA | botão primário |
| ink / `primary-hover` #FF62A2 · `primary-active` #E82E78 | 6,95 · 4,71 | AA | estados do primário |
| ink / `accent` #FFE14D | 14,91 | AAA | chip selecionado, badges |
| ink / `neon-orange` #FF7A1A | 7,44 | AAA | badges laranja |
| ink / `neon-cyan` #3DE0FF | 12,30 | AAA | tag DEMO, info |
| ink / `success` · `warning` · `danger` | 13,77 · 12,05 · 6,36 | AA+ | badges e botões de estado |
| ink / `accent-hover` #FFE97A · `accent-active` #F2D12E | 15,89 · 12,89 | AAA | estados do botão accent |
| ink / `danger-hover` #FF7A7E · `danger-active` #E84A4F | 7,71 · 5,11 | AA | estados do botão destrutivo |
| `primary` #FF3D8B como texto / `background` · `surface` · `surface-2` | 5,82 · 5,44 · 4,94 | AA | títulos e rótulos magenta |
| `primary` como texto / `surface-3` | 4,42 | só texto grande | **evitar**; use `primary-fg` |
| `primary-fg` #FF7AB0 / `background` · `surface` · `surface-2` | 8,01 · 7,49 · 6,80 | AA/AAA | links |
| `accent` / `background` · `surface` · `surface-2` | 14,91 · 13,95 · 12,67 | AAA | texto amarelo |
| `neon-orange` / `background` · `surface-2` | 7,44 · 6,32 | AA | texto laranja |
| `neon-cyan` / `background` · `surface-2` | 12,30 · 10,45 | AAA | overline ciano |
| `success` · `warning` / `surface-2` | 11,69 · 10,24 | AAA | texto de estado |
| `danger` / `background` · `surface` · `surface-2` | 6,36 · 5,95 · 5,40 | AA | ícone e texto de erro |
| `danger-fg` #FF8A8E / `background` · `surface-2` | 8,58 · 7,29 | AAA | mensagem de erro |
| `focus` #FFE14D / `background` | 14,91 | ≥ 3:1 | anel de foco |
| **Proibidos** | | | |
| `fg` (branco) / `primary` | 3,01 | reprova texto normal | nunca |
| `accent` / `primary` (amarelo sobre magenta, e vice-versa) | 2,56 | reprova | nunca como texto; só blocos decorativos lado a lado |

### 2.4 Escala do heatmap (sequencial, segura para daltônicos)
Rampa estilo "inferno" na paleta da marca: violeta → magenta → coral → laranja → amarelo, com **luminosidade (L\*) estritamente crescente**. A ordem é lida pelo claro/escuro, não pelo matiz.

| Token | Hex | L\* | Faixa |
|---|---|---|---|
| `heat-0` | `#211A3A` + borda interna 1 px `line` | 12 | zero plays |
| `heat-1` | `#3D1F66` | 20 | quantil 1 (de 6) dos valores > 0 |
| `heat-2` | `#6E1F7E` | 29 | quantil 2 |
| `heat-3` | `#B02A80` | 42 | quantil 3 |
| `heat-4` | `#EC4A6E` | 56 | quantil 4 |
| `heat-5` | `#FF8A3D` | 69 | quantil 5 |
| `heat-6` | `#FFE14D` | 90 | quantil 6 (topo) |

- **Simulação (Machado 2009, severidade total).** L\* continua monotônico para protanopia (12→88), deuteranopia (12→91) e tritanopia (12→87). O menor ΔE entre degraus vizinhos é 8, entre `heat-1` e `heat-2` na protanopia; os demais ficam ≥ 11.
- **Faixas por quantis** dos valores não nulos do período, para a escala sempre ser usada por inteiro. A legenda mostra os limites reais ("0", "1–3", "4–9"…).
- **A cor não trabalha sozinha:**
  - a célula de pico recebe um anel duplo (2 px ink + 2 px `fg`), visível até sobre o amarelo;
  - tooltip ao passar o mouse ou tocar;
  - resumo textual no `aria-label`;
  - botão "Ver como tabela" (§8.9).

### 2.5 Cores de gráfico
- **Barras (ranking, plataforma):** tom único. Trilho `surface-2`, preenchimento `primary` a 100%. O rótulo e o valor sempre aparecem em texto.
- **Categórico (se um dia precisar):** magenta, ciano, amarelo, laranja, nessa ordem, sempre com rótulo direto. Nunca mais de 4 categorias.

---

## 3. Tipografia

### 3.1 Famílias
| Papel | Família | Fallback | Por quê |
|---|---|---|---|
| Display (números, títulos, nomes grandes) | **Bricolage Grotesque** (variável: `wght` 500–800, `wdth` 75–100, `opsz` 12–96) | `"Arial Black", system-ui, sans-serif` | Grotesca expressiva, com personalidade de pôster. O eixo `wdth` dá a versão **condensada** para o line-up de festival sem trocar de família |
| Texto e UI | **Inter** (variável: `wght` 400–700, `opsz` 14–32) | `system-ui, -apple-system, "Segoe UI", Roboto, sans-serif` | Legibilidade máxima em tela pequena, algarismos tabulares (`tnum`), cobertura de latim, cirílico e grego |

- **Web:** `font-optical-sizing: auto`. Números em tabelas e rankings usam `font-variant-numeric: tabular-nums`.
- **Condensada na web:** `font-family: var(--font-display); font-stretch: 75%;`, usada só em elementos "festival".
- **Cards (satori):** famílias registradas com os nomes `Bricolage Grotesque` (600/800), `Bricolage Grotesque Condensed` (800) e `Inter` (400/600/700). Veja §13.

### 3.2 Escala (mobile → desktop ≥ 1024 px)
| Token | Família · peso | Tamanho mobile / desktop | Altura de linha | Espaçamento entre letras | Onde |
|---|---|---|---|---|---|
| `display` | Bricolage 800 | 44 / 72 px (`clamp(2.75rem, 1.6rem + 5vw, 4.5rem)`) | 0,95 | −0,03 em | Hero da landing, nº 1 do período |
| `h1` | Bricolage 800 | 32 / 44 px | 1,05 | −0,02 em | Título de página ("Seu 2024") |
| `h2` | Bricolage 700 | 24 / 30 px | 1,15 | −0,01 em | Título de seção ("Top artistas") |
| `h3` | Bricolage 700 | 20 / 22 px | 1,25 | 0 | Título de card, passos do onboarding |
| `h4` | Inter 600 | 17 / 18 px | 1,35 | 0 | Subtítulo de card, título de modal pequeno |
| `h5` = `overline` | Inter 700, CAIXA ALTA | 12 / 12 px | 1,2 | +0,12 em | Rótulo de seção/métrica (cor `info` ou `fg-muted`) |
| `h6` = `caption-strong` | Inter 600 | 13 / 13 px | 1,35 | +0,01 em | Cabeçalho de tabela |
| `metric` | Bricolage 800, `tnum` | 36 / 44 px | 1,0 | −0,02 em | Valor de card de métrica |
| `metric-sm` | Bricolage 700, `tnum` | 24 / 28 px | 1,05 | −0,01 em | Totais secundários |
| `body-lg` | Inter 400 | 18 / 18 px | 1,55 | 0 | Texto da landing e da privacidade |
| `body` | Inter 400 | 16 / 16 px | 1,5 | 0 | Padrão |
| `body-strong` | Inter 600 | 16 / 16 px | 1,5 | 0 | Nome no ranking, rótulo de botão md/lg |
| `body-sm` | Inter 400 | 14 / 14 px | 1,45 | 0 | Metadados, ajuda de campo |
| `caption` | Inter 500 | 12 / 12 px | 1,4 | +0,01 em | Legendas e notas (mínimo absoluto: 12 px) |

- Hierarquia semântica: um `h1` por página. O `h5`/`h6` visual não substitui o nível do heading no HTML.
- Comprimento de linha: no máximo 68 caracteres (`max-width: 40rem`) em texto corrido.
- Idiomas: PT-BR costuma ser ~15–25% mais longo que EN. Todo componente precisa aguentar a versão em PT sem truncar rótulo de botão.

---

## 4. Espaçamento, grid e breakpoints

- **Base 4 px** (`--spacing: 0.25rem` no Tailwind 4 → `p-4` = 16 px).
- **Escala usada:** 0 · 4 · 8 · 12 · 16 · 20 · 24 · 32 · 40 · 48 · 64 · 80 · 96 px. Fora dela, só com justificativa.

| Contexto | Valor |
|---|---|
| Gutter lateral | 16 px (< 640) · 24 px (640–1023) · 32 px (≥ 1024) |
| Espaço entre seções do dashboard | 32 px mobile · 48 px desktop |
| Padding interno de card | 16 px (< 640) · 24 px (≥ 640) |
| Gap entre cards | 12 px mobile · 16 px tablet · 24 px desktop |
| Container | `max-width: 1200px`; texto corrido `max-width: 40rem` |

| Breakpoint (Tailwind) | Min | Layout do dashboard |
|---|---|---|
| base | 360 px | 1 coluna; heatmap **vertical** (24 linhas de hora × 7 colunas de dia); barra de ação inferior fixa |
| `sm` | 640 px | 1 coluna, cards de métrica em 2 colunas |
| `md` | 768 px | 2 colunas (tops lado a lado); heatmap **horizontal** (7 × 24) |
| `lg` | 1024 px | grid de 12 colunas: tops em 8 + métricas em 4; ação "Compartilhar" no cabeçalho |
| `xl` | 1280 px | igual ao `lg`, com container de 1200 px |

- Sem scroll horizontal da página em 360 px. Listas horizontais (anos, chips) rolam **dentro** do próprio contêiner, com `scroll-snap` e máscara de degradê na borda.
- Safe areas do iOS: `padding-bottom: max(16px, env(safe-area-inset-bottom))` na barra inferior.

---

## 5. Forma

### 5.1 Raio
| Token | Valor | Uso |
|---|---|---|
| `radius-xs` | 4 px | Capas pequenas/médias (guideline do Spotify), tags |
| `radius-sm` | 8 px | Capas grandes (guideline), tooltips, badges quadradas, célula do heatmap (2 px, exceção documentada) |
| `radius-md` | 12 px | Inputs, dropzone interna, alertas |
| `radius-lg` | 16 px | Cards e painéis |
| `radius-xl` | 24 px | Modal, bottom sheet (só cantos de cima), bloco de destaque |
| `radius-full` | 9999 px | Botões, chips, segmented, selo de privacidade, avatar |

Botões em pílula remetem a ingresso e pulseira de show, e combinam com o tom amigável. Os cards ficam em 16 px para manter a leitura de "painel".

### 5.2 Bordas
- 1 px `line` em cards e divisores. 1 px `line-strong` em inputs e controles, que precisam de ≥ 3:1.
- Tracejado de 2 px `line-strong` só na dropzone.
- Erro: borda de 1 px `danger`, **mais** ícone e texto.

### 5.3 Elevação
No escuro, a elevação vem da superfície mais clara somada a uma sombra discreta. O brilho neon é reservado para o primário.

| Nível | Superfície | Sombra | Uso |
|---|---|---|---|
| `e0` | `background` | — | Página |
| `e1` | `surface` + borda `line` | — | Cards |
| `e2` | `surface-2` | `0 8px 24px -12px rgba(0,0,0,.6)` | Popover, menu, toast |
| `e3` | `surface-2` | `0 24px 64px -16px rgba(0,0,0,.7)` + `overlay` + `backdrop-filter: blur(8px)` | Modal, sheet |
| `glow` | — | `0 0 0 1px rgba(255,61,139,.35), 0 10px 32px -10px rgba(255,61,139,.55)` | Botão primário em hover; card de destaque |

---

## 6. Ícones

- **Biblioteca:** **Lucide** (`lucide-react`, licença ISC, tree-shakeable). Confirme a versão atual ao instalar (`pnpm view lucide-react version`).
- **Estilo:** outline, `strokeWidth` 2 (1,75 a partir de 24 px), cantos arredondados, `currentColor`.
- **Tamanhos:** 16 px (inline em `body-sm`), 20 px (padrão em botão e lista), 24 px (cabeçalho, estados vazios), 40 px (ilustração de estado, dropzone).
- **Acessibilidade:** decorativo → `aria-hidden="true"`. Ícone sozinho em botão → `aria-label` traduzido.
- **Mapa:**

| Conceito | Ícones Lucide |
|---|---|
| Upload | `upload` |
| Arquivo zip | `file-archive` |
| Cancelar | `x` |
| Privacidade | `shield-check`; `lock` no selo compacto |
| Offline | `wifi-off` |
| Código | `github` ou `code-2` |
| Info / tooltip | `info` |
| Aviso | `triangle-alert` |
| Erro | `circle-alert` |
| Sucesso | `circle-check` |
| Subiu / caiu | `trending-up` / `trending-down` |
| Novo | `sparkles` |
| Saiu | `log-out` (só na legenda) |
| Compartilhar | `share-2` |
| Baixar | `download` |
| Calendário / .ics | `calendar-plus` |
| Relógio (espera) | `clock` |
| Período | `calendar-range` |
| Plataforma | `smartphone`, `laptop`, `globe`, `tv`, `speaker` |
| Link externo | `external-link` |
| Idioma | `languages` |
| Sair | `log-out` |
| Tabela | `table-2` |
| Curtidas | `heart` |

- **O logo do Spotify não vem de biblioteca de ícones.** Use só o arquivo oficial (§10).

---

## 7. Movimento

| Token | Valor | Uso |
|---|---|---|
| `duration-fast` | 120 ms | Hover, pressionado, troca de cor |
| `duration-base` | 200 ms | Troca de estado, toggle, abrir tooltip |
| `duration-slow` | 320 ms | Entrada de painel, modal, sheet |
| `duration-reveal` | 600 ms | Contagem dos números de métrica, entrada do dashboard |
| `ease-standard` | `cubic-bezier(0.2, 0, 0, 1)` | Padrão |
| `ease-enter` | `cubic-bezier(0.05, 0.7, 0.1, 1)` | Elementos que entram |
| `ease-exit` | `cubic-bezier(0.3, 0, 0.8, 0.15)` | Elementos que saem (use 0,75× a duração) |

**Microinterações previstas (todas com propósito):**
- **Números de métrica:** contagem de 0 ao valor em 600 ms na primeira exibição do dashboard. Na troca de período, só crossfade de 120 ms, porque a meta de < 200 ms não admite animação que atrase a leitura.
- **Heatmap:** fade das colunas em sequência, 12 ms por coluna (máx. 300 ms), só na primeira renderização.
- **Botão primário:** `glow` em hover e `translateY(1px)` no active.
- **Modal e sheet:** entrada com opacidade + `translateY(16px → 0)` (sheet no mobile) ou `scale(.98 → 1)` (desktop), em 320 ms `ease-enter`.
- **Progresso do upload:** a barra anima a largura em 200 ms. A etapa concluída troca o número pelo ícone `circle-check` com escala 0,8 → 1.
- **Skeleton:** brilho linear que atravessa em 1,4 s, infinito.

**`prefers-reduced-motion: reduce`:**
- Desliga contagem, stagger, brilho do skeleton (fica estático), `translate` e `scale`.
- Mantém apenas crossfades de opacidade de até 120 ms.
- A barra de progresso atualiza sem transição.
- Nenhum conteúdo depende de animação para ser entendido.
- Implementação: variante `motion-safe:` do Tailwind nas animações, e `@media (prefers-reduced-motion: reduce) { *, ::before, ::after { animation-duration: .01ms !important; animation-iteration-count: 1 !important; transition-duration: .01ms !important; scroll-behavior: auto !important; } }` como rede de segurança.

---

## 8. Componentes e estados (S3.2)

Estados-padrão, que valem para **todo** controle interativo, salvo indicação:

| Estado | Regra |
|---|---|
| default | Conforme o componente |
| hover | Só em `@media (hover: hover)`, com `duration-fast` |
| focus-visible | `outline: 2px solid var(--color-focus); outline-offset: 2px`. Nunca remover o foco. `scroll-padding-top` = altura do cabeçalho fixo, para o foco não ficar escondido (2.4.11) |
| active | Superfície 1 nível mais escura ou `primary-active` |
| disabled | `disabled-bg` + `disabled-fg`, `cursor: not-allowed`, sem `opacity` no texto. Se o motivo não for óbvio, tooltip ou texto de ajuda ao lado |
| loading | `aria-busy="true"`, spinner de 16/20 px no lugar do ícone, largura travada, rótulo no gerúndio ("Gerando…") |
| error | Borda `danger` + ícone `circle-alert` + mensagem em `danger-fg`, ligada por `aria-describedby` |

- **Alvo de toque:** mínimo de 44 × 44 px, inclusive em chips e ícones (use área de toque invisível se o visual for menor). WCAG 2.5.8 exige 24 px, e nós adotamos 44.
- **Textos:** sempre via next-intl. Os exemplos abaixo estão em PT-BR.

### 8.1 Botões
| Variante | Fundo | Texto/ícone | Borda | Hover | Active | Uso |
|---|---|---|---|---|---|---|
| `primary` | `primary` | ink | — | `primary-hover` + `glow` | `primary-active` + `translateY(1px)` | 1 por tela: "Compartilhar", "Escolher arquivo" |
| `accent` | `accent` | ink | — | `#FFE97A` | `#F2D12E` | CTA da landing "Ver demo" (alternativa ao primário, nunca os dois juntos) |
| `secondary` | `surface-2` | `fg` | 1 px `line-strong` | `surface-3` | `surface` | "Baixar", "Cancelar", "Baixar lembrete" |
| `ghost` | transparente | `fg-muted` | — | `surface-2` + `fg` | `surface-3` | Ações terciárias, ícones do cabeçalho |
| `destructive` | `danger` | ink | — | `#FF7A7E` | `#E84A4F` | "Sair e apagar dados da sessão" (com confirmação) |
| `link` | — | `primary-fg`, sublinhado de 1 px com offset de 3 px | — | sublinhado de 2 px | — | Links em texto |

- **Tamanhos:**

| Tamanho | Altura | Padding horizontal | Texto | Gap ícone–rótulo | Uso |
|---|---|---|---|---|---|
| `sm` | 36 px | 14 px | `body-sm` 600 | 8 px | só desktop (área de toque de 44 px por pseudo-elemento) |
| `md` | 44 px | 20 px | `body-strong` | 8 px | padrão |
| `lg` | 52 px | 24 px | 17 px 600 | 8 px | CTA principal no mobile, largura total |

- **Anatomia:** [ícone 20 px opcional] rótulo [ícone final opcional]. Botão só de ícone: quadrado de 44 px, `radius-full`, com `aria-label`.

### 8.2 Chips, segmented control e abas
- **Segmented** (Radix `ToggleGroup type="single"`):
  - trilho `surface`, `radius-full`, padding 4 px;
  - segmentos de 36 px (a área de toque chega a 44 com o trilho);
  - rótulo `body-sm` 600 em `fg-muted`;
  - selecionado: fundo `accent`, texto ink, peso 700 e `aria-checked`, ou seja, não é só a cor que muda;
  - hover: `fg`.
  - Usado em: período (Mês | Ano | Desde sempre | Intervalo), janela do Conectar (4 semanas | 6 meses | 1 ano), template e formato do card, idioma (PT | EN).
- **Chip de filtro** (anos 2019…2024):
  - altura 36 px, `radius-full`;
  - padrão: fundo `surface-2` com texto `fg-muted`;
  - selecionado: fundo `accent`, texto ink, com ícone `check` de 16 px à esquerda;
  - lista horizontal com `scroll-snap` e rolagem até o selecionado.
- **Abas** (Radix `Tabs`), usadas no Demo como "Visão Upload | Visão Conectar":
  - sublinhado de 3 px `primary` na aba ativa;
  - rótulo `body-strong`, `fg` quando ativa e `fg-muted` quando inativa;
  - altura 48 px;
  - setas do teclado navegam (comportamento padrão do Radix).

### 8.3 Seletor de período
- **Anatomia:**
  1. segmented com o **modo** (Mês | Ano | Desde sempre | Intervalo);
  2. controle secundário, conforme o modo:
     - **Mês:** stepper `‹ mar 2024 ›`, com botões de 44 px e o rótulo entre eles;
     - **Ano:** chips de ano;
     - **Desde sempre:** sem controle, só o resumo;
     - **Intervalo:** dois `input type="date"` nativos (De / Até), com `min`/`max` = faixa do dataset. No mobile ficam num bottom sheet com o botão "Aplicar";
  3. **linha de resumo** em `body-sm` `fg-muted`: "1 jan – 31 dez 2024 · 366 dias · 9.214 plays".
- **Estados:**
  - fora da faixa do dataset: botão do stepper desabilitado;
  - intervalo inválido (De > Até): erro no campo ("A data final vem depois da inicial");
  - período sem plays: estado vazio no dashboard ("Nenhuma música nesse período. Tente outro.").
- **Troca:** sem spinner, porque a meta é < 200 ms. Uma região `aria-live="polite"` anuncia "Mostrando 2024".
- **Posição:** no mobile, sticky logo abaixo do cabeçalho, colapsado no resumo com toque para expandir. No desktop, barra fixa acima do conteúdo.

### 8.4 Card de métrica ("você por você" e totais)
- **Anatomia:**
  1. `overline` com ícone de 16 px;
  2. valor em `metric`;
  3. contexto em `body-sm` `fg-muted` (ex.: "desde 14 mar 2019");
  4. rodapé com o selo "vs. você mesmo", em `caption` `fg-subtle` com ícone `info` que abre um tooltip explicando o cálculo.
- **Variantes:**

| Variante | Visual | Uso |
|---|---|---|
| `default` | `surface`, borda `line`, `radius-lg` | Padrão |
| `highlight` | fundo `primary`, todo o texto em ink (inclusive o selo), `glow` | 1 por tela (ex.: minutos do período) |
| `compact` | Valor em `metric-sm` | Totais secundários: plays, artistas, músicas |

- **Métricas do MVP, com rótulos:**
  - "Fã desde" (data do 1º play do artista nº 1);
  - "% dos seus plays" ("23% foram Lua Vermelha");
  - "Dias diferentes" ("ouviu em 142 dias");
  - "Mais pulada";
  - "Dia mais musical".
- **Estados:**
  - loading: skeleton da forma do card;
  - vazio: "Pouco dado nesse período", com valor "—" e explicação. Ex.: "mais pulada" pede ≥ 5 skips;
  - erro: não se aplica no Upload; no Conectar, vale §8.12.

### 8.5 Ranking (top artistas / músicas / álbuns)
- **Linha:** altura mínima de 56 px (64 px com capa). Da esquerda para a direita:
  - rank em Bricolage 800, 20 px, `tnum`, 32 px de largura. Ranks 1–3 em `accent`, os demais em `fg-subtle`;
  - [Conectar: capa de 48 px, `radius-xs`, sem nada por cima];
  - bloco de texto:
    - nome em `body-strong`, com reticências em 1 linha;
    - secundário em `body-sm` `fg-muted` ("Lua Vermelha · 312 plays");
  - valor à direita em `body-sm` `tnum` `fg-muted` ("18 h 12 min").
- **Barra de proporção:** 3 px sob a linha, trilho `surface-2`, preenchimento `primary` proporcional ao nº 1. Só nos top 10.
- **Truncamento:** CSS `text-overflow: ellipsis`. O nome completo fica em `title` e no leitor de tela, porque o `<span>` tem o texto inteiro. Tocar na linha no mobile expande para 2 linhas (guideline: "o usuário deve poder ver o metadado inteiro").
- **Conectar:** a linha inteira é um link para `url` (open.spotify.com) com `target="_blank" rel="noopener noreferrer"`, e há um ícone oficial do Spotify de 21 px ao lado do valor. O cabeçalho da seção leva o logo completo (§10).
- **Controles:** segmented Artistas | Músicas | Álbuns. Mostra 10, e o botão `ghost` "Ver top 50" expande.
- **Estados:** skeleton de 5 linhas; vazio ("Sem plays nesse período"); hover `surface-2` (só em linha clicável).

### 8.6 Tendências (Conectar)
- Lista de itens com badge de estado, **sempre com ícone e texto**:
  - `success` + `trending-up` "subiu 4";
  - `danger` + `trending-down` "caiu 3";
  - `info` + `sparkles` "novo";
  - `fg-subtle` + `log-out` "saiu".
- **Badge:** altura 24 px, `radius-full`, padding 0 10 px, `caption` 600, fundo com a cor do estado e texto ink. Exceção: "saiu" usa `surface-3` com texto `fg-muted`.

### 8.7 Gêneros (Conectar, degradação)
- Com ≥ 3 gêneros: título "Seus gêneros" + badge `warning` "instável" (tooltip: "O Spotify pode deixar de fornecer este dado"). Depois vêm até 8 barras horizontais (rótulo + % em texto) e a nota "Calculado a partir dos seus top artistas".
- Com < 3 gêneros, campo ausente ou erro de parse: **a seção não é renderizada**. Nenhum card vazio nem mensagem de erro; o layout se fecha sem buraco. A página "Sobre os dados" explica que a seção pode não aparecer.
- Loading: skeleton de 4 barras.

### 8.8 Plataforma
Lista de barras com o ícone da plataforma, o rótulo ("Celular") e a % em texto ("62%"). É uma cor só, sem legenda por cor.

### 8.9 Heatmap hora × dia + tabela
- **Figura:** `<figure>` com `role="img"`.
  - `aria-label` resumido: "Você ouve mais às sextas entre 18h e 19h. Menos entre 3h e 6h".
  - `<figcaption>` visível com o mesmo resumo.
- **Mobile (< 768 px), vertical:** 7 colunas (dias) × 24 linhas (horas).
  - Células de ~40 × 14 px com gap de 2 px e `radius` de 2 px.
  - Rótulos de hora a cada 3 h (0h, 3h…) em `caption` `fg-subtle`.
  - Dias abreviados no topo ("D S T Q Q S S", com `abbr` completo).
- **≥ 768 px, horizontal:** 7 linhas × 24 colunas, com células de 1fr × 22 px.
- **Início da semana:** pelo locale (`Intl.Locale#getWeekInfo`, com fallback de domingo para pt-BR e en-US).
- **Legenda:** "menos" + as 7 amostras com os limites reais + "mais". A célula de pico ganha um anel duplo (`box-shadow: 0 0 0 2px ink, 0 0 0 4px fg`).
- **Interação:** tooltip no hover ou toque ("Sex, 18h–19h: 214 plays"). As células **não** entram na ordem de tabulação, para evitar 168 paradas.
- **"Ver como tabela":** botão `ghost` com ícone `table-2` e `aria-expanded`. Ele revela um `<table>` real:
  - `<caption>`;
  - `th scope="col"` com as horas agrupadas em 8 blocos de 3 h (para caber em 360 px sem scroll horizontal) e `th scope="row"` com os dias;
  - valores em `tnum`;
  - uma segunda visão de 24 colunas dentro de um contêiner rolável próprio, com `tabindex="0"` e rótulo.
- **Estados:** skeleton com a grade em `surface-2`; período sem dados → todas as células em `heat-0` e texto "Sem plays nesse período".

### 8.10 Upload
**Dropzone** (`<label>` que envolve um `input type="file" accept=".zip,.json,application/zip,application/json" multiple`, operável por teclado):

| Estado | Visual | Texto |
|---|---|---|
| idle | Borda tracejada de 2 px `line-strong`, `radius-lg`, `surface`, padding 32 px, ícone `upload` de 40 px `primary` | "Solte o .zip do Spotify aqui" / botão primário "Escolher arquivo" / `caption`: "Aceita o .zip ou os `Streaming_History_Audio_*.json`. Nada sai do seu aparelho." |
| hover / focus | Borda `primary-fg`, anel de foco | — |
| drag-over (válido) | Borda sólida de 2 px `primary`, fundo `rgba(255,61,139,.08)`, ícone em escala 1,05 | "Pode soltar" |
| drag-over (tipo inválido) | Borda `danger` | "Só .zip ou .json do Spotify" |
| processando | A dropzone some e o painel de progresso aparece no lugar | — |

**Progresso por etapa** (`role="group"`, com `aria-live="polite"` anunciando a cada troca de etapa e a cada 25%):
- Stepper horizontal de 3 etapas: **Descompactar → Ler → Agregar**.
  - Cada etapa tem um círculo de 28 px: pendente (`surface-2` + número `fg-subtle`), ativa (borda `primary` + spinner) ou concluída (`success` + `circle-check` ink).
  - Rótulo da etapa em `body-sm`.
- Barra geral de 8 px (`radius-full`, trilho `surface-2`, preenchimento `primary`) com % à direita em `tnum`.
- Detalhe em `body-sm` `fg-muted`: "Arquivo 3 de 7 · Streaming_History_Audio_2021.json".
- Botão `secondary` "Cancelar" com ícone `x`. Não pede confirmação: cancela na hora, aborta o worker e mostra o toast "Cancelado. Nada foi guardado."
- Selo de privacidade compacto logo abaixo, reforçando a mensagem no momento de maior ansiedade.

**Erros de upload** (alerta `radius-md`, `surface`, borda esquerda de 4 px `danger`, ícone `circle-alert`, título `h4`, texto `body-sm`, ações; `role="alert"`). O código vem do worker (Sprint 1):

| Código | Título | Texto e ação |
|---|---|---|
| `NOT_ZIP` / `ZIP_INVALID` | "Não consegui abrir esse arquivo" | "Ele não parece um .zip válido. Envie o arquivo que o Spotify mandou por e-mail, sem descompactar." · [Tentar outro arquivo] |
| `NO_HISTORY_FILES` | "Esse zip não tem o histórico estendido" | "Procuramos `Streaming_History_Audio_*.json` e não achamos. Talvez seja o pacote básico de dados da conta." · [Como pedir o histórico estendido] [Tentar outro] |
| `LIMITS` (bomb, entradas demais, tamanho) | "Arquivo grande demais ou fora do padrão" | "Por segurança, recusamos arquivos acima de 1 GB descompactado ou com compressão suspeita." · [Tentar outro] |
| `FORMAT` (> 5% de registros inválidos) | "O formato mudou ou o arquivo está corrompido" | "Mais de 5% dos registros não estão no formato esperado." · [Tentar outro] · link "Avisar no GitHub" |
| `OUT_OF_MEMORY` / falha do worker | "O navegador ficou sem memória" | "Tente num computador ou feche outras abas." · [Tentar de novo] |
| `CANCELLED` | — | Não mostra alerta; volta ao idle e dispara o toast acima |

**Aviso de recarga:** banner `info` no topo do dashboard de upload: "Seus dados ficam só nesta aba. Se recarregar, você precisa enviar o arquivo de novo." Pode ser fechado; a escolha fica em sessionStorage.

### 8.11 Varredura de curtidas (Conectar)
- **Idle:** card com `h3` "De quem você tem mais músicas curtidas?", `body-sm` "Lemos sua biblioteca página por página. Pode levar ~1 min." e botão primário "Descobrir".
- **Rodando:** barra + texto "Página 12 de 48", `tnum`, e botão "Cancelar".
- **Pronto:** nome do artista em `metric` + "214 músicas curtidas" + `caption` "atualizado há 2 h" + botão `ghost` "Atualizar".
- **Cancelado:** volta ao idle, sem resultado parcial.
- **Erros:** conforme §8.12.

### 8.12 Erros de conta e de API
| Caso | Onde | Visual | Texto | Ações |
|---|---|---|---|---|
| **401** sessão expirada / `invalid_grant` | Página inteira do Conectar | Estado vazio centralizado, ícone `lock` de 40 px `fg-muted` | "Sua sessão expirou" · "Por segurança, a conexão com o Spotify dura pouco. Conecte de novo para continuar." | [Conectar de novo] (primário) |
| **403** fora da allowlist | Página inteira | Estado vazio, ícone `shield-check` `info` | "Este app ainda está em modo de teste" · "O Spotify só deixa 5 contas convidadas usarem o modo Conectar de um app novo. O seu histórico funciona sem convite." | [Enviar meu histórico] (primário) [Ver demo] (secundário) |
| **429** rate limit | Na seção afetada | Alerta `warning`, ícone `clock` | "O Spotify pediu uma pausa" · "Tentando de novo em **12 s**." Contagem visual; o leitor de tela ouve só o anúncio inicial e o de conclusão | [Tentar agora] desabilitado até zerar |
| **503 `QUOTA`** | Banner global sob o cabeçalho, todas as queries pausadas | Alerta `warning` de largura total | "Limite de consultas do app atingido" · "O Encore divide uma cota com todos os usuários. Volte em ~15 min. Upload e Demo continuam funcionando." | [Enviar meu histórico] [Ver demo] |
| **UPSTREAM** / timeout | Na seção | Card `surface` com ícone `circle-alert` `danger` | "Não deu para carregar esta seção" | [Tentar de novo] |
| Conectar desabilitado (sem credenciais) | Landing | Card do modo com `disabled-bg`, botão desabilitado | "Indisponível nesta instalação" + tooltip "O dono do site não configurou o acesso ao Spotify" | — |

A falha de uma seção nunca derruba as outras (RNF-05).

### 8.13 Toasts
- **Posição:** mobile na base, centralizado, acima da barra inferior (`bottom: 88px + safe-area`). Desktop no canto inferior direito.
- **Visual:** largura de até 420 px, `surface-2`, `e2`, `radius-md`, borda esquerda de 4 px na cor do tipo (`info`/`success`/`warning`/`danger`), ícone de 20 px, texto `body-sm`, ação opcional (link) e fechar (`x`, 44 px).
- **Comportamento:**
  - `role="status"` (erro: `role="alert"`);
  - some sozinho em 5 s, com pausa no hover ou foco; erro que pede ação não some;
  - 1 toast visível por vez, os demais em fila.

### 8.14 Modal de compartilhamento
- **Contêiner:** Radix `Dialog`. No mobile é um bottom sheet (altura de até 92 dvh, alça de 36 × 4 px, `radius-xl` só no topo); no desktop, modal de 880 px com duas colunas (prévia | controles).
- **Conteúdo, nesta ordem:**
  1. `h2` "Compartilhar";
  2. segmented **Template**: Festival | Básico. O padrão é **Festival**, o mais "compartilhável";
  3. segmented **Formato**: Stories 9:16 | Quadrado 1:1;
  4. [Festival] campo opcional "Nome no cartaz" (`maxlength=20`, placeholder "Encore Fest", ajuda "Fica só na imagem, não é enviado a lugar nenhum");
  5. **prévia**: `<img>` do PNG gerado, dentro de uma caixa com o `aspect-ratio` do formato e `radius-md`. No mobile ocupa até 56 dvh;
  6. nota em `caption`: Conectar → "Inclui a atribuição ao Spotify"; Demo → "Card marcado como DEMO";
  7. ações: primário largura total "Compartilhar" (ícone `share-2`) quando `navigator.canShare({files})`; senão, o primário é "Baixar PNG" (`download`). O secundário "Baixar" aparece sempre que o primário é Compartilhar.
- **Estados:**
  - gerando: prévia em skeleton com o texto "Montando seu cartaz…" e botões em loading;
  - pronto;
  - erro: alerta inline "Não consegui gerar a imagem" + [Tentar de novo];
  - compartilhado ou baixado: toast `success`.
- **3 toques:** (1) "Compartilhar" no dashboard abre o modal, que **já começa a gerar** o Festival 9:16; (2) "Compartilhar"; (3) escolher o app. O blob é gerado antes do toque (gesto do usuário preservado no iOS).
- Foco inicial no título. `Esc` e o botão fechar (44 px) encerram. O foco volta para o botão de origem.

### 8.15 Skeletons
- Blocos `surface-2` com os `radius` do componente final e as mesmas dimensões, para não haver *layout shift*.
- Brilho em `linear-gradient(90deg, transparent, rgba(245,241,255,.06), transparent)` atravessando em 1,4 s; estático com reduced-motion.
- O contêiner leva `aria-busy="true"` e um texto `sr-only` "Carregando…".

### 8.16 Selo de privacidade
- **Compacto** (pílula, altura 32 px, `radius-full`, `surface`, borda 1 px `line-strong`, ícone `lock` de 16 px `success` + `caption` 600 `fg`). O texto depende do modo:
  - Upload/landing: "Processado no seu aparelho";
  - Conectar: "Nada fica guardado no servidor";
  - Demo: "Dados fictícios · sem rede".
  - É um botão (área de toque de 44 px) que abre o expandido num popover (desktop) ou sheet (mobile).
- **Expandido** (card `surface`, `radius-lg`, padding 24 px, borda superior de 3 px `success`):
  - `h3` "Seus dados ficam com você";
  - 4 itens com ícone de 20 px:
    1. `shield-check` "O arquivo é lido no seu navegador e nunca é enviado";
    2. `database`, riscado com `aria-hidden`: "Sem banco de dados, sem contas, sem analytics";
    3. `wifi-off` "Depois de carregar, funciona offline. Teste: desligue a internet e envie o arquivo";
    4. `github` "Código aberto: confira você mesmo" → `NEXT_PUBLIC_REPO_URL`.
  - No Conectar, o item 1 vira "Seu acesso ao Spotify fica num cookie criptografado; os dados, só nesta aba".
  - Link final "Política de privacidade".
- Aparece na landing (expandido, como seção), no cabeçalho do dashboard (compacto) e no painel de upload (compacto).

### 8.17 Onboarding "Como pedir seu histórico"
- **Estrutura:** `h1` "Peça seu histórico ao Spotify" + intro `body-lg` + **alerta `warning`** com ícone `clock`: "O Spotify pode levar até 30 dias para enviar. Geralmente chega antes."
- **Stepper vertical** de 4 passos. Cada passo é um card `surface` com número em Bricolage 800 32 px `accent`, `h3` e texto:
  1. "Abra a página de privacidade da sua conta Spotify" → link externo `spotify.com/account/privacy` com ícone `external-link`;
  2. "Marque **Histórico de streaming estendido** e desmarque o resto" (destaque em `body-strong`);
  3. "Confirme pelo e-mail que o Spotify enviar";
  4. "Quando chegar o e-mail com o .zip, volte aqui e solte o arquivo."
- **Ações:**
  - [Baixar lembrete (.ics)] (secundário, `calendar-plus`), gerado no cliente, com toast "Lembrete baixado — nada foi enviado";
  - bloco "Enquanto isso" com dois cards de modo: [Ver demo] (primário) e [Conectar com Spotify] (secundário, ou desabilitado com o motivo).
- No mobile, os passos vêm em coluna única; no desktop, o stepper tem 640 px e o "Enquanto isso" fica ao lado (lg).

### 8.18 Navegação e cabeçalho
- **Cabeçalho:** altura 56 px, sticky, `background` a 85% + `backdrop-filter: blur(12px)`, borda inferior `line`. Da esquerda para a direita:
  - wordmark "encore" (Bricolage 800, 22 px, `primary`, com `letter-spacing` −0,02 em);
  - badge do modo (Upload / Conectado / DEMO em `info`);
  - espaçador;
  - selo compacto (≥ 640 px);
  - idioma (menu `ghost` com ícone `languages`);
  - [Conectar] avatar com menu → "Sair". O logout usa `destructive` com confirmação "Sair apaga a sessão e o cache desta aba".
- **Barra de ação inferior (mobile, dashboard):** altura 72 px + safe area, `surface` com borda superior `line`. À esquerda, o resumo do período (toque abre o seletor); à direita, o botão primário "Compartilhar".
- **Landing:**
  - hero com `display` "Seu ano em música. Quando você quiser.";
  - 3 cards de modo (Upload em destaque com borda `primary`, Conectar, Demo);
  - seção do selo expandido;
  - rodapé com "Encore não é afiliado ao Spotify" + links (Privacidade, Código, idioma).

### 8.19 Inputs de formulário
- Altura 44 px, `surface`, borda 1 px `line-strong`, `radius-md`, padding 0 14 px, texto `body` `fg`, placeholder `fg-subtle`.
- **Rótulo:** sempre visível acima, `body-sm` 600 `fg`.
- **Ajuda:** `caption` `fg-muted`.
- **Estados:**
  - focus: borda `primary` + anel de foco;
  - error: borda `danger` + mensagem `danger-fg` com ícone;
  - disabled: `disabled-bg`.
- **Data:** `input type="date"` nativo com `color-scheme: dark`.

### 8.20 Tabelas
- **Cabeçalho:** `h6` `fg-muted`, borda inferior `line`.
- **Linhas:** 44 px, zebra `surface`/`background`.
- **Números:** à direita, `tnum`.
- **Caption:** visível, `body-sm`.
- **Rolagem:** a tabela larga rola dentro do próprio contêiner (com foco e rótulo), nunca a página.

---

## 9. Templates de card (S3.3)

Implementação: satori → SVG → resvg-wasm → PNG. **Só flexbox**: todo `div` com mais de um filho precisa de `display: flex`, e não há grid nem `foreignObject`. As fontes são as TTF estáticas de §13. A referência executável é `design/cards/templates.mjs`, com as prévias em `design/cards/preview/`.

### 9.1 Canvas e áreas seguras
| Formato | Canvas | Área segura (conteúdo) | Por quê |
|---|---|---|---|
| **Stories 9:16** | 1080 × 1920 | topo 250 px · base 280 px · laterais 72 px → área útil de 936 × 1390 | O Instagram e o WhatsApp cobrem ~250 px no topo (barra de progresso e perfil) e ~250–280 px na base (campo de resposta). Só gradientes decorativos entram nessas faixas |
| **Quadrado 1:1** | 1080 × 1080 | 72 px em todos os lados → 936 × 936 | Feed e WhatsApp; sem sobreposição de UI |

### 9.2 Hierarquia comum
1. **Cabeçalho:** wordmark "encore" (magenta) + chip do período (ink sobre amarelo) + tag **DEMO** (ink sobre ciano) no modo Demo.
2. **Herói:** nº 1 do período (artista), o maior texto do card.
3. **Listas:** top artistas e top músicas (Básico) ou line-up em 3 níveis (Festival).
4. **Destaque:** bloco magenta com texto ink (Básico) ou linha de estatísticas laranja (Festival).
5. **Rodapé** (sempre dentro da área segura): wordmark branco + `encore.app` à esquerda; atribuição à direita (§9.6).

### 9.3 Template "Básico"
| Elemento | 9:16 | 1:1 |
|---|---|---|
| Fundo | `linear-gradient(180deg,#0E0B1A,#17122A)` + brilho radial laranja a 35% no canto superior direito | igual |
| Cabeçalho | wordmark Bricolage 800, 44 px · chip Inter 700, 28 px | 36 px · 28 px |
| Rótulo "Artista nº 1" | Inter 600, 32 px `fg-muted` | 24 px |
| Herói (nome) | Bricolage 800, linha única, em degraus: ≤ 10 grafemas 128 px · ≤ 14 → 104 · ≤ 18 → 84 · ≤ 24 → 64 · acima disso, trunca em 24 com "…" | 96 · 80 · 64 · 52 |
| Sub-herói | Inter 600, 30 px `neon-orange` (Upload: "1.284 plays · fã desde mar/2019"; Conectar: "em alta: subiu 3 posições") | 24 px |
| Top artistas 2–5 | rank Bricolage 800, 40 px `accent` (coluna de 56 px) + nome Inter 600, 34 px, 1 linha, orçamento de 18 | rank 34 px + nome 30 px, orçamento de 16 |
| Top músicas 1–5 | nome Inter 600, 34 px (orçamento de 23) + artista Inter 400, 24 px `fg-muted` (orçamento de 24) | 4 músicas, só o nome, orçamento de 18 |
| Capa (só Conectar) | 260 × 260, raio 16 px, ao lado dos artistas | 220 × 220, no lugar do bloco de destaque |
| Bloco de destaque | `primary`, raio 24, padding 22 × 32; valor Bricolage 800, 80 px ink + rótulo Inter 600, 30 px ink | valor 64 px + rótulo 24 px (só sem capa) |
| Espaçamento | gap vertical de 40 px entre blocos; gap mínimo de 32 px antes do rodapé | `space-between` |

### 9.4 Template "Line-up de festival" (sempre tipográfico, sem capas, nos 3 modos)
| Elemento | 9:16 | 1:1 |
|---|---|---|
| Fundo | "noite de show": `linear-gradient(180deg,#0E0B1A 0%,#140E28 55%,#2A0F3D 82%,#4A1247 100%)` + holofote radial magenta (55%) no canto superior esquerdo + holofote ciano (40%) no direito | igual |
| "ENCORE APRESENTA" | Inter 700, 28 px `neon-cyan`, `letter-spacing` 8 | 22 px |
| Título | Bricolage **Condensed** 800 `primary`, linha única: "ENCORE FEST" ou "FESTIVAL {NOME}"; degraus ≤ 18 → 104 px · ≤ 24 → 84 · ≤ 30 → 68, com truncamento | 72 · 60 · 50 |
| Chip do período | Inter 700, 30 px ink sobre `accent`, CAIXA ALTA | 24 px |
| Headliner nº 1 | Condensed 800 `accent`, CAIXA ALTA, linha única; ≤ 11 → 150 px · ≤ 15 → 120 · ≤ 20 → 96 · trunca em 20 | 104 · 84 · 68 |
| Headliners nº 2–3 | Condensed 800 `fg`, 80% do degrau do nº 1. **Os dois ficam com o mesmo tamanho** (o menor dos dois) | idem |
| Divisor | linha de 3 px `primary` + losango de 14 px `accent` no centro | igual |
| Nível 2 (nº 4–10) | Condensed 800, 62 px `fg`, nomes separados por "  •  ", no máximo 3 linhas (`lineClamp`) | 44 px, 3 linhas |
| Nível 3 (nº 11–25) | Inter 600, 32 px `fg-muted`, `letter-spacing` 1, no máximo 5 linhas | nº 11–20, 24 px, 3 linhas |
| Estatísticas | Inter 700, 28 px `neon-orange`, CAIXA ALTA: Upload/Demo "48.213 MIN · 9.214 PLAYS · 612 ARTISTAS"; Conectar "TOP 25 ARTISTAS · ÚLTIMOS 6 MESES" | 22 px |

**Nome no cartaz:** opcional, digitado no modal, com até 20 grafemas. Sem nome, o título é "ENCORE FEST". No Conectar, **não** preenchemos com `display_name` automaticamente (privacidade: o usuário decide o que vai na imagem).

### 9.5 Regras de truncamento e texto
- **Por grafema** (`Intl.Segmenter`), para não quebrar emoji nem acento combinado. O "…" é um único caractere (U+2026).
- **Orçamento → degrau de fonte → truncamento.** Primeiro se tenta o maior degrau que comporta o texto. No menor degrau, trunca. Como rede de segurança, `whiteSpace: nowrap; overflow: hidden; textOverflow: ellipsis` nos textos de linha única, e `lineClamp` nos blocos de line-up.
- **Espaços inquebráveis** (U+00A0) dentro de cada nome do line-up: a quebra acontece só nos separadores "•", nunca no meio de "COLETIVO SAMAMBAIA".
- **Cobertura de glifos:** Bricolage cobre latim, latim estendido e vietnamita. Nomes com outros sistemas de escrita (cirílico, grego) caem automaticamente no Inter, que é registrado no satori. Esses nomes descem 1 degrau (`outsideDisplayCoverage`), porque o Inter é mais largo. Testado com "Жанна Агузарова" em `preview/*-stress.png`.
- **CJK, árabe, emoji:** não cobertos no MVP e renderizados como caixa vazia. Pendência: carregar sob demanda uma fonte Noto self-hosted via `loadAdditionalAsset` do satori, só quando o texto exigir (ver §15). Enquanto isso, a prévia no modal mostra o card antes do compartilhamento, e o usuário pode trocar de template.
- **Não usar** os glifos ♪ e ★, que nenhuma das fontes tem. Ornamentos são formas (div com `transform: rotate(45deg)`) ou SVG.
- **CAIXA ALTA** com `toLocaleUpperCase(locale)`.
- **Números** formatados por `Intl.NumberFormat(locale)`: "48.213" em pt-BR, "48,213" em en.

### 9.6 Variações por modo
| | **Upload** | **Demo** | **Conectar** |
|---|---|---|---|
| Capas | Não, sempre tipográfico | Não | Básico: capa da música nº 1 (sem corte, sem sobreposição, raio 16 px no canvas ≈ 5,5 pt na tela, dentro da faixa de 4–8 px da guideline). Festival: não |
| Estatística do Básico | minutos do período | minutos | "músicas curtidas do artista nº 1" (se a varredura rodou) ou "gênero nº 1" (se houver ≥ 3) ou nada (o bloco some) |
| Estatística do Festival | min · plays · artistas | idem | "TOP 25 ARTISTAS · {JANELA}" |
| Tag | — | **DEMO** (ink sobre ciano) no cabeçalho, obrigatória | — |
| Rodapé direito | Texto `fg-subtle` 22 px: "Do seu histórico do Spotify · processado no seu aparelho" (menção nominal, sem logo) | "Modo demo · artistas e músicas fictícios" (sem citar o Spotify) | **Logo completo oficial do Spotify, branco**, largura de 210 px (≈ 73 px na tela de 375 pt, acima do mínimo de 70 px), sozinho, com área de proteção ≥ metade da altura do ícone. **Sem** texto do tipo "Dados de" encostado (não usar o logo em frase) |

- **Imagens no Conectar:** a capa precisa ser passada ao satori como dados (ArrayBuffer ou data URL). Isso exige buscar `i.scdn.co` no cliente, ou seja, liberar `img-src`/`connect-src https://i.scdn.co` na CSP, ou criar uma rota de proxy de imagem no BFF. **Decisão de arquitetura pendente (ADR)**; ver §15.
- **Fallback:** se a capa falhar, o card sai na versão tipográfica, sem erro.

### 9.7 Exportação
- PNG em 1080 px de largura (`fitTo: width`), sem transparência.
- Tamanho medido: ~190–410 kB. Tempo no Node, sem cache de fontes: 0,8–3 s. No navegador, gerar ao abrir o modal (§8.14).
- Nome do arquivo: `encore-{template}-{formato}-{periodo}.png` (ex.: `encore-festival-stories-2024.png`), com o período sanitizado para `[a-z0-9-]`.

---

## 10. Checklist de branding do Spotify (S3.4)

Fonte: Spotify Design Guidelines (developer.spotify.com/documentation/design), consultado em 2026-09-24. RNF-13.

| # | Regra | Como o Encore aplica | Status no design |
|---|---|---|---|
| 1 | O nome do app não pode conter "Spotify" nem soar ou parecer com ele | **Encore**, que também não usa "Wrapped" | ✅ |
| 2 | Não imitar a marca do Spotify nem a do Wrapped | Paleta própria sem o verde do Spotify (`success` é menta `#52F2C8`, e nunca aparece junto do logo). Nenhuma fonte, forma ou layout do Wrapped | ✅ |
| 3 | Não combinar a marca do Spotify com outra marca | O logo do Spotify fica em área própria, separado do wordmark "encore" pelo espaço do rodapé; nunca em lockup | ✅ |
| 4 | Metadados do Spotify (artista, álbum, faixa, capa) vêm sempre acompanhados da marca | Toda seção com dado da API tem o **logo completo** no cabeçalho da seção (altura de 21 px na web, ≈ 70 px de largura); cards do Conectar levam o logo no rodapé | ✅ especificado (§8.5, §9.6) |
| 5 | Usar o **logo completo** (ícone + wordmark); o ícone sozinho só se faltar espaço | Logo completo nos cabeçalhos de seção e nos cards. Ícone sozinho (≥ 21 px) só no link de cada linha do ranking | ✅ |
| 6 | Tamanho mínimo: logo completo ≥ 70 px e ícone ≥ 21 px (digital) | Web: logo completo com ≥ 72 px de largura, ícone de 21–24 px. Card: 210 px no canvas de 1080 | ✅ |
| 7 | Área de proteção = metade da altura do ícone | Padding de 16 px no card; ≥ 12 px na web | ✅ |
| 8 | Cor do logo: branco em fundo escuro, preto em fundo claro, verde só em preto/branco. Não recolorir, rotacionar, esticar, aplicar efeito nem pôr em área poluída | Sempre a **versão branca** oficial sobre `background`/`surface` (fundos lisos). Nunca sobre gradiente forte nem sobre capa | ✅ |
| 9 | Não usar o logo dentro de frase ("Dados de [logo]") | O logo aparece sozinho; o texto de apoio fica em outro lugar | ✅ (corrigido no protótipo) |
| 10 | Usar só os arquivos oficiais | Baixar de `https://developer.spotify.com/images/guidelines/design/2024-spotify-full-logo.zip` (logo completo) e `…/2024-spotify-logo-icon.zip` (ícone), em SVG. **Não redesenhar**; o mockup usa um espaço reservado | ⏳ o dev-frontend baixa na S5.5 |
| 11 | Capa no formato original: sem corte, sem distorção, sem texto ou imagem por cima, sem o nosso logo por cima | `aspect-ratio: 1` + `object-fit: contain` (a capa é quadrada). Rank e rótulos ficam **ao lado**, nunca sobre a capa. Sem degradê, blur ou tint | ✅ |
| 12 | Raio da capa: 4 px em telas pequenas/médias, 8 px em telas grandes | `radius-xs` (4 px) em capas de até 64 px; `radius-sm` (8 px) em capas maiores; 16 px no canvas do card de 1080 (≈ 5,5 pt exibido) | ✅ |
| 13 | Metadados sempre com link de volta ao Spotify | Linha do ranking clicável → `url` (open.spotify.com), mais o ícone. Textos permitidos: "ABRIR NO SPOTIFY" / "OUVIR NO SPOTIFY" (EN: "OPEN SPOTIFY" / "PLAY ON SPOTIFY" / "LISTEN ON SPOTIFY"). Em imagem PNG não existe link; o logo cumpre a atribuição | ✅ web · ℹ️ card |
| 14 | Pode truncar, mas o usuário tem que conseguir ver o metadado inteiro. Referência de limite: artista 18, faixa 23, álbum/playlist 25 caracteres | UI: reticências + `title` + expandir no toque. Cards: orçamentos de 18/23 (e maiores onde cabe), e a prévia no modal mostra o card antes do envio | ✅ |
| 15 | Deixar claro que não somos o Spotify | Rodapé do site: "Encore não é afiliado nem endossado pelo Spotify." (PT/EN) | ✅ |
| 16 | Modo Upload (dado do arquivo do próprio usuário, não da API) | Menção nominal em texto ("do seu histórico do Spotify"), **sem logo**, para não sugerir integração oficial | ✅ |
| 17 | Modo Demo (dado fictício) | Nenhum metadado real, portanto sem atribuição; tag **DEMO** em toda tela e em todo card | ✅ |

---

## 11. Acessibilidade (resumo do que o design garante)
- **Contraste:** todos os pares de texto usados estão em §2.3 (≥ 4,5:1) e os controles têm ≥ 3:1. Os pares proibidos estão listados.
- **Foco:** anel amarelo de 2 px + offset de 2 px (14,9:1 sobre o fundo) em tudo que é interativo, sem ficar escondido pelo cabeçalho fixo.
- **Toque:** ≥ 44 × 44 px.
- **Cor nunca sozinha:** estado e selecionado têm ícone, peso ou texto; o heatmap tem pico marcado, tooltip, resumo e tabela; as tendências têm ícone e palavra.
- **Movimento:** §7, com `prefers-reduced-motion`.
- **Semântica:** Radix para dialog, tabs, toggle-group e popover; `lang` no `<html>` por locale; `aria-live` só para progresso, troca de período e erros.
- **Zoom:** o layout funciona com texto a 200% e reflow em 320 px de largura (1.4.10), sem scroll horizontal na página.
- **Cards (imagem):** o modal traz um texto alternativo gerado ("Card Festival: Lua Vermelha, Os Ventiladores, Marina Sal…"), e o `alt` da prévia usa esse texto.

---

## 12. Tokens para o Tailwind 4 (`src/app/globals.css`)
Contrato direto: copie como está. As utilities saem dos nomes (`bg-surface`, `text-fg-muted`, `border-line-strong`, `rounded-lg`, `font-display`, `text-h1`, `shadow-e2`, `ease-enter`…).

```css
@import "tailwindcss";

@font-face {
  font-family: "Bricolage Grotesque";
  src: url("/fonts/BricolageGrotesque-VF-latin.woff2") format("woff2-variations");
  font-weight: 500 800; font-stretch: 75% 100%; font-style: normal; font-display: swap;
}
@font-face {
  font-family: "Inter";
  src: url("/fonts/Inter-VF-latin.woff2") format("woff2-variations");
  font-weight: 400 700; font-style: normal; font-display: swap;
}

@theme {
  /* reset da paleta padrão do Tailwind: só os nossos tokens existem */
  --color-*: initial;

  /* paleta base */
  --color-neon-magenta: #FF3D8B;
  --color-neon-yellow: #FFE14D;
  --color-neon-orange: #FF7A1A;
  --color-neon-cyan: #3DE0FF;
  --color-stage-950: #0E0B1A;
  --color-stage-900: #17122A;
  --color-stage-850: #211A3A;
  --color-stage-800: #2B2248;
  --color-stage-700: #342A52;
  --color-stage-500: #7D71A8;
  --color-stage-400: #968CB8;
  --color-stage-300: #B8AED6;
  --color-stage-50:  #F5F1FF;

  /* semânticos (valores literais para funcionar em qualquer contexto) */
  --color-background: #0E0B1A;
  --color-surface: #17122A;
  --color-surface-2: #211A3A;
  --color-surface-3: #2B2248;
  --color-fg: #F5F1FF;
  --color-fg-muted: #B8AED6;
  --color-fg-subtle: #968CB8;
  --color-line: #342A52;
  --color-line-strong: #7D71A8;
  --color-primary: #FF3D8B;
  --color-primary-hover: #FF62A2;
  --color-primary-active: #E82E78;
  --color-primary-fg: #FF7AB0;
  --color-on-vibrant: #0E0B1A;
  --color-accent: #FFE14D;
  --color-accent-hover: #FFE97A;
  --color-accent-active: #F2D12E;
  --color-focus: #FFE14D;
  --color-success: #52F2C8;
  --color-warning: #FFC23D;
  --color-danger: #FF5A5F;
  --color-danger-hover: #FF7A7E;
  --color-danger-active: #E84A4F;
  --color-danger-fg: #FF8A8E;
  --color-info: #3DE0FF;
  --color-disabled-bg: #2B2248;
  --color-disabled-fg: #8A80AA;
  --color-overlay: rgb(8 6 16 / 0.72);
  --color-transparent: transparent;
  --color-current: currentColor;

  /* heatmap (sequencial, L* crescente, seguro para daltônicos) */
  --color-heat-0: #211A3A;
  --color-heat-1: #3D1F66;
  --color-heat-2: #6E1F7E;
  --color-heat-3: #B02A80;
  --color-heat-4: #EC4A6E;
  --color-heat-5: #FF8A3D;
  --color-heat-6: #FFE14D;

  /* tipografia */
  --font-display: "Bricolage Grotesque", "Arial Black", system-ui, sans-serif;
  --font-sans: "Inter", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;

  --text-display: clamp(2.75rem, 1.6rem + 5vw, 4.5rem);
  --text-display--line-height: 0.95;
  --text-display--letter-spacing: -0.03em;
  --text-display--font-weight: 800;
  --text-h1: 2rem;       --text-h1--line-height: 1.05;  --text-h1--letter-spacing: -0.02em; --text-h1--font-weight: 800;
  --text-h1-lg: 2.75rem; --text-h1-lg--line-height: 1.05; --text-h1-lg--letter-spacing: -0.02em; --text-h1-lg--font-weight: 800;
  --text-h2: 1.5rem;     --text-h2--line-height: 1.15;  --text-h2--letter-spacing: -0.01em; --text-h2--font-weight: 700;
  --text-h2-lg: 1.875rem; --text-h2-lg--line-height: 1.15; --text-h2-lg--letter-spacing: -0.01em; --text-h2-lg--font-weight: 700;
  --text-h3: 1.25rem;    --text-h3--line-height: 1.25;  --text-h3--font-weight: 700;
  --text-h4: 1.0625rem;  --text-h4--line-height: 1.35;  --text-h4--font-weight: 600;
  --text-overline: 0.75rem; --text-overline--line-height: 1.2; --text-overline--letter-spacing: 0.12em; --text-overline--font-weight: 700;
  --text-caption-strong: 0.8125rem; --text-caption-strong--line-height: 1.35; --text-caption-strong--font-weight: 600;
  --text-metric: 2.25rem;  --text-metric--line-height: 1; --text-metric--letter-spacing: -0.02em; --text-metric--font-weight: 800;
  --text-metric-lg: 2.75rem; --text-metric-lg--line-height: 1; --text-metric-lg--letter-spacing: -0.02em; --text-metric-lg--font-weight: 800;
  --text-metric-sm: 1.5rem; --text-metric-sm--line-height: 1.05; --text-metric-sm--font-weight: 700;
  --text-body-lg: 1.125rem; --text-body-lg--line-height: 1.55;
  --text-body: 1rem;        --text-body--line-height: 1.5;
  --text-body-sm: 0.875rem; --text-body-sm--line-height: 1.45;
  --text-caption: 0.75rem;  --text-caption--line-height: 1.4; --text-caption--letter-spacing: 0.01em; --text-caption--font-weight: 500;

  /* espaço (base 4 px: p-1 = 4px, p-4 = 16px) */
  --spacing: 0.25rem;

  /* breakpoints: padrões do Tailwind (sm 40rem, md 48rem, lg 64rem, xl 80rem) */
  --container-page: 75rem;   /* 1200px */
  --container-prose: 40rem;  /* texto corrido */

  /* raio */
  --radius-xs: 4px;
  --radius-sm: 8px;
  --radius-md: 12px;
  --radius-lg: 16px;
  --radius-xl: 24px;
  --radius-full: 9999px;

  /* elevação */
  --shadow-e2: 0 8px 24px -12px rgb(0 0 0 / 0.6);
  --shadow-e3: 0 24px 64px -16px rgb(0 0 0 / 0.7);
  --shadow-glow: 0 0 0 1px rgb(255 61 139 / 0.35), 0 10px 32px -10px rgb(255 61 139 / 0.55);

  /* movimento */
  --ease-standard: cubic-bezier(0.2, 0, 0, 1);
  --ease-enter: cubic-bezier(0.05, 0.7, 0.1, 1);
  --ease-exit: cubic-bezier(0.3, 0, 0.8, 0.15);
  --animate-shimmer: shimmer 1.4s linear infinite;
  --animate-sheet-in: sheet-in 320ms cubic-bezier(0.05, 0.7, 0.1, 1);

  @keyframes shimmer { from { background-position: -200% 0; } to { background-position: 200% 0; } }
  @keyframes sheet-in { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: none; } }
}

:root {
  color-scheme: dark;
  --duration-fast: 120ms;
  --duration-base: 200ms;
  --duration-slow: 320ms;
  --duration-reveal: 600ms;
  --header-h: 56px;
}
html { background: var(--color-background); color: var(--color-fg); font-family: var(--font-sans); scroll-padding-top: calc(var(--header-h) + 16px); }
:focus-visible { outline: 2px solid var(--color-focus); outline-offset: 2px; }
.tnum { font-variant-numeric: tabular-nums; }
.font-condensed { font-family: var(--font-display); font-stretch: 75%; }

@media (prefers-reduced-motion: reduce) {
  *, ::before, ::after {
    animation-duration: 0.01ms !important; animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important; scroll-behavior: auto !important;
  }
}
```

Uso de títulos responsivos: `text-h1 lg:text-h1-lg`, `text-h2 lg:text-h2-lg`, `text-metric lg:text-metric-lg`.

**Tabela-resumo `token → valor`** (a mesma do bloco acima, para consulta rápida):

| Grupo | Tokens |
|---|---|
| Cor (semântica) | background `#0E0B1A` · surface `#17122A` · surface-2 `#211A3A` · surface-3 `#2B2248` · fg `#F5F1FF` · fg-muted `#B8AED6` · fg-subtle `#968CB8` · line `#342A52` · line-strong `#7D71A8` · primary `#FF3D8B` · primary-hover `#FF62A2` · primary-active `#E82E78` · primary-fg `#FF7AB0` · on-vibrant `#0E0B1A` · accent `#FFE14D` · focus `#FFE14D` · success `#52F2C8` · warning `#FFC23D` · danger `#FF5A5F` · danger-fg `#FF8A8E` · info `#3DE0FF` |
| Heatmap | heat-0…6: `#211A3A` `#3D1F66` `#6E1F7E` `#B02A80` `#EC4A6E` `#FF8A3D` `#FFE14D` |
| Espaço | base 4 px; escala 4·8·12·16·20·24·32·40·48·64·80·96 |
| Raio | xs 4 · sm 8 · md 12 · lg 16 · xl 24 · full 9999 |
| Sombra | e2, e3, glow (acima) |
| Tipo | display, h1(-lg), h2(-lg), h3, h4, overline, caption-strong, metric(-lg/-sm), body-lg, body, body-sm, caption |
| Movimento | 120 · 200 · 320 · 600 ms; standard, enter, exit |

**Versão para o satori:** o objeto `C` em `design/cards/templates.mjs` espelha esses hex. Mantenha os dois em sincronia; o ideal é um `src/features/cards/tokens.ts` gerado a partir de uma fonte única.

---

## 13. Fontes (S3.6)

**Origem:** repositório oficial `github.com/google/fonts`, branch `main`, commit `23e54b5` (2026-09-24), de `ofl/bricolagegrotesque/BricolageGrotesque[opsz,wdth,wght].ttf` (v1.001) e `ofl/inter/Inter[opsz,wght].ttf` (v4.001).

**Licença:** SIL OFL 1.1, **sem Reserved Font Name**. Instanciar e fazer subset é permitido e mantém os nomes. As licenças estão em `design/fonts/OFL-*.txt` e devem ir junto para `public/fonts/`.

**Geração reprodutível:** `design/fonts/build_fonts.py` (fontTools 4.55 + brotli). Uso: `python build_fonts.py <pasta-com-os-VF-originais> <saída>`.

| Arquivo | Uso | Configuração | Tamanho |
|---|---|---|---|
| `ttf/BricolageGrotesque-ExtraBold.ttf` | satori | estático, `wght` 800 · `wdth` 100 · `opsz` 96 | 79 kB |
| `ttf/BricolageGrotesque-SemiBold.ttf` | satori | `wght` 600 · `wdth` 100 · `opsz` 96 | 79 kB |
| `ttf/BricolageGrotesqueCondensed-ExtraBold.ttf` | satori (festival) | `wght` 800 · **`wdth` 75** · `opsz` 96; família "Bricolage Grotesque Condensed" | 79 kB |
| `ttf/Inter-Regular.ttf` · `Inter-SemiBold.ttf` · `Inter-Bold.ttf` | satori | estáticos 400/600/700, `opsz` 28; latim + latim estendido + **cirílico + grego** (fallback de nomes) | ~230 kB cada |
| `woff2/BricolageGrotesque-VF-latin.woff2` | web | variável, `wght` 500–800, `wdth` 75–100, `opsz` 12–96; latim + latim estendido | 170 kB |
| `woff2/Inter-VF-latin.woff2` | web | variável, `wght` 400–700, `opsz` 14–32; latim + latim estendido | 144 kB |

- **Por que TTF estático no satori:** o satori não lê WOFF2 nem eixos variáveis (renderizaria só a instância padrão).
- **Por que WOFF2 variável na web:** um arquivo por família cobre todos os pesos e a largura condensada.
- **Carregamento na web:**
  - `<link rel="preload" as="font" type="font/woff2" crossorigin>` só para o Inter;
  - Bricolage com `font-display: swap`;
  - fontes self-hosted, sem Google Fonts em runtime (a CSP proíbe; PADRÕES §2).
- **Carregamento nos cards:** os TTF são buscados só quando o modal de compartilhamento abre (lazy), junto com o satori e o resvg (RNF-03). Total: ~925 kB, com cache HTTP imutável.
- **Mover para o app (S4.1):** `design/fonts/woff2/*` e `design/fonts/ttf/*` → `public/fonts/`; `OFL-*.txt` → `public/fonts/`.

---

## 14. Tema claro (futuro, fora do MVP)
- Os tokens semânticos (§2.2) já permitem o tema claro sem tocar nos componentes: basta redefinir as variáveis sob `[data-theme="light"]`.
- **Rascunho não verificado:** background `#FBF8FF` · surface `#FFFFFF` · fg `#1A1330` · fg-muted `#4E4470` · primary `#D6186A` (texto branco) · accent `#8A6D00` (só texto).
- Na regra "texto escuro sobre vibrante", os fundos amarelo e ciano continuam com ink.
- Exige nova rodada de contraste. **Os cards continuam sempre escuros**, porque são identidade.

---

## 15. Pendências e decisões para o cliente / outros papéis
1. **Aprovar** a paleta, a tipografia, os dois templates de card (ver `design/cards/preview/`) e o mockup.
2. **ADR (dev-frontend + segurança): capas no card Conectar.** Exigem os bytes da imagem de `i.scdn.co`. Opções:
   - (a) `connect-src`/`img-src https://i.scdn.co` na CSP;
   - (b) rota `/api/spotify/image` no BFF com allowlist de host;
   - (c) card Conectar sem capa, igual ao Upload.
   - Recomendação do design: **(a)**, se o `i.scdn.co` responder com CORS. Senão, **(c)** no MVP.
3. **Fonte para CJK/árabe nos cards:** fora do MVP. Hoje esses nomes viram caixa vazia no PNG. Sugestão: Noto Sans (JP/KR/SC/Arabic) self-hosted, carregada sob demanda via `loadAdditionalAsset`.
4. **Logo oficial do Spotify:** o dev-frontend baixa os SVGs oficiais (§10, item 10) na S5.5. O mockup e o protótipo usam espaço reservado.
5. **Domínio:** o rodapé do card usa "encore.app" como espaço reservado. Troque pelo domínio real (`NEXT_PUBLIC_SITE_URL`) sem protocolo.
