# Encore · logo (3 conceitos)

Pedido do cliente (2026-09-28): uma logo criativa que converse com a identidade Palco Neon, com as cores dos cards de compartilhamento e com o tema de festival. Passo **8b.7** da Iteração 8b.

**Situação:** o cliente escolheu o **conceito 2 (Bis), variação 3 "Alinhada com a barra"**, em 2026-09-28. O ajuste 1 (seta solta embaixo) não foi aprovado; o ajuste 2 trouxe as variações 3, 4 e 5 (`pranchas/conceito-2-ajuste-2.png`), e a 3 foi a escolhida. A logo está aplicada no app (8b.9): cabeçalho, rodapé, pôster da landing, cards e ícones (`app/icon.svg`, `favicon.ico` com 16 px sem seta, `apple-icon.png`); ver `10-design.md` §16. Os conceitos 1 e 3 ficam aqui só como registro.

## Arquivos

| Arquivo | O que é |
|---|---|
| `conceito-N.svg` | Lockup horizontal (símbolo + wordmark), com o limite justo, sem margem |
| `conceito-N-simbolo.svg` | Só o símbolo, grade de 64 × 64. É a fonte do favicon (16/32/48 px) |
| `conceito-N-icone-app.svg` | Ícone de app de 180 × 180, com fundo até a borda (o iOS aplica a máscara arredondada) |
| `conceito-2-favicon-16.svg` | Só no conceito 2: símbolo simplificado, sem seta, para o favicon de 16 px |
| `pranchas/conceito-2-ajuste.png` | Registro do ajuste 1 (não aprovado): antes e depois da seta solta embaixo |
| `pranchas/conceito-2-ajuste-2.png` | Ajuste 2: original (1), ajuste 1 (2) e as variações 3, 4 e 5 lado a lado, cada uma com o ícone de 180 px, a seta ampliada com a medida do respiro, o cabeçalho a 22 px (real e 3×), o favicon em 32 e 16 px e os respiros medidos |

Os quatro arquivos `conceito-2*.svg` e a `prancha-conceito-2.png` mostram a **variação 3** (recomendada). As variações 4 e 5 só existem na prancha do ajuste 2; se o cliente escolher uma delas, os SVGs são regerados trocando `REC` no `build-logo.mjs`.
| `pranchas/prancha-conceito-N.png` | Prancha de cada conceito: lockup, símbolo, cabeçalho do site em tamanho real, favicon em 16 e 32 px (aba escura, aba clara e 16 px ampliado), ícone de 180 px e o card Festival (story) com o logo no rodapé |
| `pranchas/prancha-comparativa.png` | Os três lado a lado, para a escolha |
| `build-logo.mjs` | Gera todos os arquivos acima: `node docs/projeto/design/logo/build-logo.mjs` (da raiz do projeto). Com `… build-logo.mjs 2`, gera só os arquivos e as pranchas do conceito 2 |

Os SVGs são só paths e gradientes: o texto foi convertido em contorno a partir da Bricolage Grotesque ExtraBold (normal e condensada), então nenhum arquivo depende de fonte instalada. A Bricolage é OFL 1.1, que permite usar a fonte em logotipos; o contorno é arte, não redistribui a fonte.

## Os conceitos

### 1 · Ingresso: "o ingresso do seu próprio festival"
- **Símbolo:** um ingresso inclinado a −8°, com entalhes na linha de destaque. O corpo magenta `#FF3D8B` leva o "e" da marca em tinta `#0E0B1A` (5,82:1). O canhoto amarelo `#FFE14D` repete o chip de período dos cards e leva o losango do divisor do lineup.
- **Wordmark:** "encore" em Bricolage ExtraBold, `fg` `#F5F1FF` (17,48:1 sobre `background`), tracking −0,02 em. O ingresso tem 2 × a altura-x do wordmark e fica centrado nela.
- **Em tamanho pequeno:** a silhueta do ingresso (magenta + amarelo, com os entalhes) é o que se reconhece em 16 px; o "e" aparece a partir de 32 px. É o único dos três que dispensa placa: funciona em aba clara e escura.
- **Cabeçalho (22 px de corpo):** 106 × 23 px.

### 2 · Bis: "o bis vem no fim: a última letra é o próprio bis" (escolhido)
- **Símbolo:** o "e" desenhado como um traço que dá a volta e termina numa seta que fecha a letra de volta na barra, "de novo!". O traço tem degradê magenta → laranja `#FF7A1A` → amarelo, a luz do palco acendendo outra vez. Evolui o favicon atual (um "e" magenta de traço), então a troca mantém o reconhecimento.
- **Wordmark:** "encor" em Bricolage ExtraBold magenta, e o último "e" é o próprio símbolo. Sozinho, o símbolo vai sobre uma placa `#0E0B1A` com raio de 14/64.
- **Em tamanho pequeno:** a seta se lê a partir de 32 px no símbolo; no cabeçalho, a 22 px, ela é um detalhe pequeno, mas com o respiro aberto. Em 16 px entra `conceito-2-favicon-16.svg`, sem seta. Precisa da placa escura no favicon, porque o amarelo não contrasta com aba clara.
- **Cabeçalho (22 px de corpo), variação 3:** 68 × 12 px, o mais discreto dos três conceitos.

#### Ajuste 1 (não aprovado)
Pedido: a seta estava colada na barra. Resposta: o traço passou a terminar a 76°, com a seta solta embaixo, apontando para a frente. O respiro abriu (1,3 px a 22 px; 3,4 px a 32 px; 18,9 px a 180 px), mas a letra ficou aberta embaixo, e o cliente quer a seta fechando no "e". Registro em `pranchas/conceito-2-ajuste.png`; parâmetros em `BIS.v2`.

#### Ajuste 2: a seta fecha no "e", como a perna do G (variação 3 escolhida)
O problema da versão original não era a direção, era a proporção: a seta era grossa demais e encavalava na barra. O que muda em todas as variações novas:
- **Barra do "e"** mais fina (0,68 do traço; 0,6 na variação 5) e levantada 0,32 traço acima do centro, reta até a borda de fora. Isso abre a contraforma de baixo, que é onde a seta mora, e cria o vão em esquina sob a barra, como no G.
- **Seta** triangular, simétrica e limpa, com a base perpendicular ao traço (a emenda com o traço some) e meia-largura de 0,72 traço (0,62 na variação 5), mais estreita que a da original (0,8).
- **Comprimento da ponta** calculado para um respiro-alvo, e não mais no olho.

| | 3 · Alinhada com a barra (recomendada) | 4 · Tocando por baixo | 5 · Encaixada no vão |
|---|---|---|---|
| Onde encontra a barra | segue o próprio círculo e para rente à ponta da barra | o traço desce mais e a ponta gira 18° para dentro, apontando para baixo da barra | entra na esquina sob a ponta da barra |
| Fim do arco | 40° | 52° | 32° |
| Traço (lockup / símbolo) | 0,135 corpo / 10 | 0,135 / 10 | **0,125 / 9,2** (mais leve) |
| Ponta: meia-largura / comprimento (traços) | 0,72 / 0,84 | 0,72 / 1,22 (mais longa) | 0,62 / 0,83 (mais fina) |
| Respiro-alvo no lockup | 0,40 traço | 0,38 traço | 0,30 traço |
| Respiro a 22 / 32 / 180 px | 1,2 / 2,7 / 15,3 px | 1,1 / 2,8 / 15,6 px | 0,8 / 2 / 11,3 px |

Para comparar: a original tem −0,1 px a 22 px e 0,4 px a 32 px (encosta nos dois) e 2,4 px a 180 px.

**Por que a 3:** é a leitura mais direta do "e que fecha como o G". A seta continua a curva do próprio círculo, então a letra fica compacta e a ponta aponta exatamente para a ponta da barra. Tem o maior respiro proporcional nos três usos, e o traço é o mesmo do resto do wordmark. A 4 aponta melhor para dentro, mas a ponta mais longa pesa no canto inferior. A 5 é a mais elegante no ícone grande, mas no cabeçalho o respiro cai para 0,8 px e o traço leve destoa das outras letras.

**Favicon de 16 px:** continua necessário. Em 16 px, qualquer seta vira dois ou três pixels que fecham a contraforma. As variações 3 a 5 usam um "e" sem seta com a mesma barra fina (raio 24, traço 9, barra 0,75, arco até 50°), que mantém as duas contraformas abertas.

### 3 · Cartaz: "o cartaz do festival inteiro num ícone"
- **Símbolo:** um "E" em estêncil, como as letras pintadas nos cases de equipamento de turnê, cortado em três faixas que repetem a hierarquia do lineup: headliner em amarelo, segunda linha em `fg`, terceira em magenta. A placa usa o fundo "noite de show" do card Festival: holofote magenta no canto superior esquerdo, ciano no direito, degradê violeta embaixo.
- **Wordmark:** "ENCORE" em Bricolage ExtraBold **Condensed**, caixa-alta, magenta, como o título "ENCORE FEST" do card. A placa tem 1,5 × a altura das maiúsculas.
- **Em tamanho pequeno:** as três faixas coloridas se leem em 16 px; os cortes do estêncil aparecem a partir de 32 px.
- **Cabeçalho (22 px de corpo):** 82 × 22 px.

## Regras de uso (valem para o conceito escolhido)

- **Fundo:** sempre escuro e liso, ou os degradês dos cards: `background` `#0E0B1A`, `surface` `#17122A`, `surface-2` `#211A3A`, fundos "noite de show" e "básico" dos cards. O site é só escuro; uma versão para fundo claro (wordmark em tinta) só é feita se aparecer a necessidade.
- **Contraste do wordmark:** `fg` 17,48:1 · magenta 5,82:1 em `background`, 5,44:1 em `surface` e 4,94:1 em `surface-2` (AA para texto normal). No ponto mais claro do degradê do card Festival (`#4A1247`), o magenta fica em 4,28:1, acima dos 3:1 exigidos para texto grande; lá o wordmark tem sempre ≥ 24 px, então passa.
- **Área de respiro:** nada encosta no logo a menos de **1 x**, sendo x a altura do "e" do wordmark. No conceito 3, x é metade da altura da placa. No símbolo sozinho, o respiro é 1/8 do lado.
- **Tamanho mínimo:** símbolo com 16 px. Lockup com 64 px de largura no conceito 2, 80 px no conceito 3 e 96 px no conceito 1. Abaixo disso, use só o símbolo.
- **Não pode:** recolorir fora da paleta, esticar, girar (o ingresso já vem inclinado), pôr sombra, contorno ou brilho, pôr sobre capa de álbum ou foto, e montar lockup com o logo do Spotify. O logo do Spotify fica sempre na área própria dele (10-design.md §10, regra 3).
- **Distância da marca Spotify:** nenhum conceito usa verde nem ondas curvas paralelas. O arco do conceito 2 é um traço único que forma uma letra, sem arcos concêntricos.

## Depois da escolha (8b.9, dev-frontend)

1. `app/icon.svg` ← `conceito-N-simbolo.svg`; `app/favicon.ico` com 32 e 48 px renderizados do mesmo arquivo; `app/apple-icon.png` ← `conceito-N-icone-app.svg` em 180 px. No conceito 2, a camada de 16 px do `favicon.ico` sai do `conceito-2-favicon-16.svg`, sem seta.
2. Cabeçalho: o wordmark de texto vira o lockup em SVG inline (22 px de corpo, tamanhos acima), com `aria-label="Encore"`.
3. Cards: o wordmark de texto do rodapé e do cabeçalho do card Básico vira o lockup como `img` (as pranchas usam 44 px de altura no story para os conceitos 1 e 3 e 30 px para o 2).
4. Design: registrar a logo escolhida no `10-design.md` (tokens, respiro, mínimos) e remover os conceitos não escolhidos daqui, se o cliente quiser.
