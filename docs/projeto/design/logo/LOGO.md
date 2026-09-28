# Encore · logo (3 conceitos)

Pedido do cliente (2026-09-28): uma logo criativa que converse com a identidade Palco Neon, com as cores dos cards de compartilhamento e com o tema de festival. Passo **8b.7** da Iteração 8b.

**Situação:** o cliente escolheu o **conceito 2 (Bis), variação 3 "Alinhada com a barra"**, em 2026-09-28. O ajuste 1 (seta solta embaixo) não foi aprovado; o ajuste 2 trouxe as variações 3, 4 e 5 (`pranchas/conceito-2-ajuste-2.png`), e a 3 foi a escolhida. A variação 3 está aplicada no app (8b.9): cabeçalho, rodapé, pôster da landing, cards e ícones (`app/icon.svg`, `favicon.ico` com 16 px sem seta, `apple-icon.png`); ver `10-design.md` §16.

**Em aberto (8c.1 → 8c.2):** o **ajuste 4** é o mesmo "e" da variação 3, só girado para a esquerda (`pranchas/conceito-2-ajuste-4.png`). Os quatro `conceito-2*.svg` já mostram o ângulo recomendado, **−12°**. A variação 3 aplicada no app está guardada em `conceito-2*-v3.svg`, e o ajuste 3, **reprovado**, em `conceito-2*-ajuste3.svg`. O app só muda depois da escolha do ângulo pelo cliente (8c.3). Os conceitos 1 e 3 ficam aqui só como registro.

## Arquivos

| Arquivo | O que é |
|---|---|
| `conceito-N.svg` | Lockup horizontal (símbolo + wordmark), com o limite justo, sem margem |
| `conceito-N-simbolo.svg` | Só o símbolo, grade de 64 × 64. É a fonte do favicon (16/32/48 px) |
| `conceito-N-icone-app.svg` | Ícone de app de 180 × 180, com fundo até a borda (o iOS aplica a máscara arredondada) |
| `conceito-2-favicon-16.svg` | Só no conceito 2: símbolo simplificado, sem seta, para o favicon de 16 px |
| `pranchas/conceito-2-ajuste.png` | Registro do ajuste 1 (não aprovado): antes e depois da seta solta embaixo |
| `pranchas/conceito-2-ajuste-2.png` | Ajuste 2: original (1), ajuste 1 (2) e as variações 3, 4 e 5 lado a lado, cada uma com o ícone de 180 px, a seta ampliada com a medida do respiro, o cabeçalho a 22 px (real e 3×), o favicon em 32 e 16 px e os respiros medidos |
| `pranchas/conceito-2-ajuste-4.png` | Ajuste 4: a conferência (o "e" girado, desgirado, sobre o original, com a imagem da diferença e os números) e as colunas "atual", −8°, −12° e −16°, cada uma com o lockup ampliado, o cabeçalho a 22 px (real e 3×), o símbolo em 32 px, o favicon de 16 px, o ícone de 180 px, o rodapé do card story e as medidas |
| `pranchas/conceito-2-ajuste-3.png` | Ajuste 3 (reprovado): as proporções do "e" (fonte, variação 3 e ajuste 3 na mesma escala, com a tabela de medidas) e as colunas "atual", −8°, −12° e −16°, cada uma com o lockup ampliado, o cabeçalho a 22 px (real e 3×), o símbolo em 32 px, o favicon de 16 px, o ícone de 180 px, o rodapé do card story e as medidas |
| `conceito-2*-v3.svg` | Registro da variação 3 do ajuste 2, a versão aplicada no app até o 8c.3 (lockup, símbolo, ícone de app e favicon de 16 px). É a base do ajuste 4 |
| `conceito-2*-ajuste3.svg` | Registro do ajuste 3 a −12°, reprovado |
| `pranchas/prancha-conceito-N.png` | Prancha de cada conceito: lockup, símbolo, cabeçalho do site em tamanho real, favicon em 16 e 32 px (aba escura, aba clara e 16 px ampliado), ícone de 180 px e o card Festival (story) com o logo no rodapé |
| `pranchas/prancha-comparativa.png` | Os três lado a lado, para a escolha |
| `build-logo.mjs` | Gera todos os arquivos acima: `node docs/projeto/design/logo/build-logo.mjs` (da raiz do projeto). Com `… build-logo.mjs 2`, gera só os arquivos do conceito 2, a `prancha-conceito-2.png` e a prancha do ajuste 4. O ângulo do "e" é a constante `GIRO` (padrão −12); para testar outro sem editar: `… build-logo.mjs 2 --giro=-16`. `… build-logo.mjs medir` imprime as medidas do "e" sem gravar nada. As pranchas dos ajustes 1, 2 e 3 são registro e só são regeradas com `… build-logo.mjs ajuste1`, `ajuste2` ou `ajuste3` |

Os quatro arquivos `conceito-2*.svg` e a `prancha-conceito-2.png` mostram o **ajuste 4 a −12°** (recomendado). Se o cliente escolher −8° ou −16°, basta trocar `GIRO` no `build-logo.mjs` e rodar `… build-logo.mjs 2`. As variações 4 e 5 do ajuste 2 só existem na prancha do ajuste 2.

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
- **Cabeçalho (22 px de corpo):** 68 × 12 px, na variação 3 e no ajuste 4. É o mais discreto dos três conceitos.

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

#### Ajuste 3: o "e" redesenhado e girado (8c.1, reprovado)
**Reprovado pelo cliente em 2026-09-28.** A resposta dele foi "quero apenas que pegue o E original e apenas rotacione; os rotacionados estão todos distorcidos, diferente do E original reto". O redesenho mudou a letra que ele já tinha aprovado: elipse no lugar do círculo, contraste de traço, barra, olho e seta novos. Todas as correções abaixo foram descartadas; ficam só como registro (`conceito-2*-ajuste3.svg`, `pranchas/conceito-2-ajuste-3.png`). O que vale é o ajuste 4.

Pedido do cliente (2026-09-28), que gostou da logo aplicada: girar "um pouco para a esquerda" o "e" com seta, "para ficar um pouco mais dinâmico", e garantir que ele esteja correto visualmente, com seta e larguras em boa proporção. Só o "e" gira, no sentido anti-horário; "encor" continua reto.

**Revisão da variação 3.** Na mesma escala do "e" de "encor" (Bricolage ExtraBold), a variação 3 tinha seis desvios:
1. **Tamanho óptico:** o "e" era um círculo de 56 × 56, 7% mais largo que o "o" da própria fonte (52,3) e 12% mais largo que o "e" (49,8). Por isso parecia uma letra de corpo maior. Altura e overshoot estavam certos (0,2 de diferença para os redondos).
2. **Traço:** era monolinear, com 13,5 em toda a volta. A Bricolage 800 tem contraste: 16,1 nas laterais, 12,7 em cima e 12,1 embaixo. As laterais ficavam 16% mais leves que as do "e" de "encor", e o topo, 7% mais pesado. No total, o "e" tinha 4% mais tinta que o da fonte, mas mal distribuída.
3. **Barra e olho:** a barra (9,2) ficava 4,3 acima do centro. O olho (a contraforma de cima) tinha 5,6 de altura, contra 9,3 no "e" da fonte. A 22 px, isso dá 1,2 px, e o olho quase fecha.
4. **Ponta da seta:** a meia-largura era 0,72 traço e o comprimento, 0,84 traço. Isso dá uma ponta rombuda, de 81°, com aba de só 0,22 traço para cada lado. De longe, lia-se como o fim de um traço cortado.
5. **Emenda:** a seta era um triângulo à parte, com contorno redondo de 1,08, por cima do traço. O contorno engordava a ponta, e a emenda dependia da sobreposição das duas peças.
6. **Posição da ponta:** a ponta seguia a tangente do círculo e parava na borda de fora, alinhada com a ponta da barra. A letra fechava por fora, e não para dentro, como a perna do G.

**Correções (antes → depois).** Medidas em unidades de corpo 100; o lockup tem 55,6 de altura.

| Medida | Variação 3 | Ajuste 3 | Referência na Bricolage 800 |
|---|---|---|---|
| Caixa do "e" (L × A) | 56 × 56, círculo | **51,2 × 55,6**, elipse | "e" 49,8 × 55,6 · "o" 52,3 × 55,6 |
| Traço nas laterais | 13,5 | **16,0** | 16,1 |
| Traço em cima / embaixo | 13,5 | **12,6** | 12,7 / 12,1 |
| Barra | 9,2, 4,3 acima do centro | **8,8**, 2,2 acima do centro | 8,9, 1,4 acima do centro |
| Olho (altura) | 5,6 | **8,6** | 9,3 |
| Tinta em relação ao "e" da fonte | +4,0% | **−3,5%** (a −12°) | 1.889 u² |
| Ponta: meia-largura × comprimento | 0,72 × 0,84 traço | **0,80 × 1,22 traço** | |
| Ângulo da ponta · aba para cada lado | 81° · 0,22 traço | **67° · 0,30 traço** | |
| Direção da ponta | tangente ao círculo | **mira a quina de baixo da barra**, 13° para dentro da tangente (é o quanto a curva ainda giraria) | |
| Onde a ponta para | na borda de fora | **0,43 traço para dentro da ponta da barra** | |
| Emenda seta / traço | 2 peças sobrepostas; contorno de 1,08 na seta | **1 contorno só**: a base da seta é o próprio corte do traço, perpendicular à mira; sem degrau nem emenda | |
| Cantos da ponta | contorno redondo em tudo | **raio de 0,05 traço só nos 3 cantos da ponta** | |
| Fim do traço | 40° | **64°** (calculado pelo respiro-alvo) | |
| Respiro-alvo ponta ↔ barra | 0,40 traço | **0,45 do traço horizontal (5,7)** | |
| Respiro a 22 / 32 / 180 px | 1,2 / 2,7 / 15,3 px | **1,25 / 2,35 / 13,2 px** | |
| Lockup (corpo 100) | 308,3 × 56 | **303,2 × 55,6** | |

- **Por que a tinta fica 3,5% abaixo da do "e" da fonte:** o "e" é o único em degradê, e o amarelo e o laranja brilham bem mais que o magenta sobre o fundo escuro. Com a mesma tinta, ele pareceria mais pesado que "encor". Os traços (16,0 e 12,6) são os da fonte; a diferença vem da abertura da seta.
- **Por que o respiro a 32 e 180 px ficou um pouco menor:** a variação 3 usava no símbolo um traço mais leve que o do lockup (10 em raio 23). O ajuste 3 usa o mesmo desenho nos dois, para que o símbolo e o "e" do wordmark sejam a mesma letra. Os 2,35 px a 32 px ainda separam bem a ponta da barra.

**O giro e o que foi compensado:**
- **Centro do giro:** o centro da elipse. Barra, seta, contraste do traço e degradê giram juntos, como um objeto só. O contraste inclinado reforça a sensação de movimento.
- **Linha de base e altura-x:** uma elipse mais estreita que alta perde altura quando gira (a −12°, perde 0,1). O semieixo vertical sobe para compensar: 27,84 a −8°, 27,90 a −12° e 27,97 a −16°. Assim o "e" girado continua de 0 a 55,6, com o mesmo overshoot de 1,4 dos redondos de "encor".
- **Espaço r–e:** o giro aproxima o ombro de cima do "e" do braço do "r". A posição do "e" é calculada por duas medidas: o branco entre "r" e "e" na faixa da altura-x e a menor distância até a ponta do braço do "r". Essa distância nunca fica menor que a do "e" da própria fonte (1,94). Nos três ângulos, ela fica entre 2,05 e 2,15, e o "e" não invade o "r". O branco fica entre 492 e 494 u², entre o da fonte (453) e o da variação 3 (507).
- **Centragem na placa:** o centro óptico é a média entre o centro da caixa da tinta e o centroide, e fica 0,5/64 acima do meio. A seta pesa no canto de baixo à direita, e a caixa sozinha puxaria o "e" para a esquerda. No ícone de 180 px a −12°, por exemplo, a caixa vai de x 31,7 a 151,7 e o centroide está em x 88,4. O "e" ocupa 67% da largura e 72% da altura da placa.

**Ângulos da prancha:**

| | −8° | **−12° (recomendado)** | −16° |
|---|---|---|---|
| Subida da barra no cabeçalho (22 px) | 1,1 px | 1,6 px | 2,2 px |
| Leitura | quase reto; no cabeçalho parece erro de alinhamento, não intenção | giro claro, sem tombar; a seta aponta para cima e para a frente | o mais dinâmico; o "e" começa a cair para trás e o olho vira uma fenda inclinada |
| Espaço r–e (branco · menor distância) | 494 u² · 2,15 | 493 u² · 2,05 | 493 u² · 2,05 |
| Lockup (corpo 100) | 303,1 × 55,6 | 303,2 × 55,6 | 303,4 × 55,6 |

**Por que −12°:** é o menor ângulo que se lê como intenção também no cabeçalho, onde a barra sobe 1,6 px em 7,6 px de comprimento. A −8°, a subida fica perto de 1 px, e o "e" parece torto por engano. A −16°, o "e" já parece cair para trás, disputa com a seta e destoa demais de "encor", que é reto. O pedido foi "um pouco", e −12° é o meio da faixa que funciona.

**O favicon de 16 px (sem seta) também gira.** O `favicon.ico` leva as camadas de 16, 32 e 48 px, e o navegador escolhe uma pela densidade da tela: a mesma pessoa vê ora o 16, ora o 32. Com só o 16 reto, a marca mudaria de uma tela para outra e ao lado do cabeçalho, que é girado. Em 16 px, a barra girada sobe 1,8 px ao longo de 8 px e fica um pouco menos nítida que a reta. O olho e a abertura continuam abertos, porque o "e" sem seta usa:
- traço mais leve (laterais 13, horizontais 10,8, barra 8,2);
- fim do traço em 52°;
- barra 1,2 acima do centro.

Para voltar ao 16 px reto, basta `GIRA_16 = false` no `build-logo.mjs`.

#### Ajuste 4: o mesmo "e", só girado (8c.1, recomendado −12°)
O pedido é o mesmo do ajuste 3, com a correção do cliente: pegar o "e" original e **apenas girar**.
- **Base:** o "e" é exatamente o da variação 3. Os paths de `conceito-2*-v3.svg` giram como um bloco rígido em volta do centro do círculo: arco, barra, seta e degradê juntos. Só há rotação e translação; nenhuma escala, nenhuma mudança de forma.
- **O que não muda:** o raio (28 no lockup, 23 no símbolo, 24 no favicon de 16 px), o `stroke-width` (13,5 e 1,08 da seta no lockup; 10 e 0,8 no símbolo; 9 no favicon), a seta, a barra e as cores do degradê.
- **Como fica no arquivo:** os SVGs finais continuam só com paths, sem `transform`. As coordenadas giradas foram calculadas e gravadas no próprio `d`. O degradê gira junto, pelas pontas `x1/y1/x2/y2`, que também foram giradas.

**Conferência (bloco no alto da prancha).** Os paths finais foram "desgirados" e comparados com os da variação 3, por coordenada e por pixel:

| | Maior desvio de coordenada | Pixel máximo | Média | Pixels com diferença > 32/255 |
|---|---|---|---|---|
| Lockup −8° | 0,01 | 61/255 | 0,05 | 0,011% |
| Lockup −12° | 0 | 61/255 | 0,04 | 0,005% |
| Lockup −16° | 0 | 61/255 | 0,04 | 0,007% |
| Ícone 180 px −8° | 0,01 | 60/255 | 0,03 | 0,002% |
| Ícone 180 px −12° | 0,01 | 61/255 | 0,01 | 0% |
| Ícone 180 px −16° | 0,01 | 30/255 | 0,02 | 0% |

- **Coordenadas:** o desvio vem só do arredondamento em 2 casas, em unidades de corpo 100.
- **Pixels:** o lockup foi renderizado a 8× e o ícone a 3×. As diferenças aparecem só no contorno, por causa do antialiasing de um contorno 0,01 deslocado. Longe da borda, a diferença é de 1/255.
- **Conclusão:** a forma é idêntica. Os comandos (M, L, A, Z), os raios e os `stroke-width` são os mesmos. Na imagem de diferença ×8 da prancha, só aparece o fio do contorno.

**Encaixe com "encor" (só translação, e quase nenhuma):**
- **Linha de base e altura-x:** o giro é em volta do centro do círculo, e um círculo girado é o mesmo círculo. O "e" continua de 0 a 56, com o centro na altura-x e o mesmo overshoot da variação 3. Não foi preciso transladar na vertical.
- **Espaço r–e:** o lado esquerdo do "e" é o próprio círculo, que o giro não move. A menor distância até a ponta do braço do "r" continua 2,83, igual à da variação 3, nos três ângulos. O "e" não encosta no "r", e a translação horizontal calculada deu 0.
- **Largura:** a −8° e a −12°, a seta girada fica dentro da borda do círculo, e o lockup continua com **308,3 × 56**, igual à variação 3. A −16°, a aba de fora da seta passa um pouco da borda, e o lockup vai a 308,47 × 56.
- **Símbolo, ícone e favicon:** o "e" da placa da variação 3 foi girado em volta do centro dele. Depois foi transladado para manter o mesmo centro óptico da variação 3 aprovada, medido como a média do centro da caixa da tinta e do centroide. A translação, na grade de 64, é:

  | Ângulo | Translação (x, y) | No ícone de 180 px |
  |---|---|---|
  | −8° | +0,10 , −0,07 | até 0,3 px |
  | −12° | +0,17 , −0,10 | até 0,5 px |
  | −16° | +0,09 , −0,14 | até 0,4 px |

- **Favicon de 16 px sem seta:** também gira, pelo mesmo motivo do ajuste 3. As camadas de 16, 32 e 48 px do `.ico` precisam ter a mesma silhueta.
- **Respiro seta ↔ barra:** 1,2 / 2,7 / 15,3 px a 22 / 32 / 180 px, idêntico ao da variação 3, porque a seta e a barra giram juntas.

**Ângulos e recomendação:** no cabeçalho de 22 px, a parte visível da barra (42,5 unidades, 9,4 px) sobe 1,3 px a −8°, 2,0 px a −12° e 2,7 px a −16°.
- **−8°:** a barra sobe tão pouco que, no cabeçalho, o giro parece erro, não intenção.
- **−16°:** é o mais dinâmico, mas o "e" começa a tombar diante de "encor", que é reto, e a lockup fica um pouco mais larga.
- **−12° (recomendado):** o giro fica claro sem tombar, e a lockup mantém a mesma caixa da variação 3.

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
- **Não pode:** recolorir fora da paleta, esticar, girar o logo inteiro (o giro do "e" do conceito 2 e a inclinação do ingresso já fazem parte do desenho), pôr sombra, contorno ou brilho, pôr sobre capa de álbum ou foto, e montar lockup com o logo do Spotify. O logo do Spotify fica sempre na área própria dele (10-design.md §10, regra 3).
- **Distância da marca Spotify:** nenhum conceito usa verde nem ondas curvas paralelas. O arco do conceito 2 é um traço único que forma uma letra, sem arcos concêntricos.

## Depois da escolha (8b.9, dev-frontend)

1. `app/icon.svg` ← `conceito-N-simbolo.svg`; `app/favicon.ico` com 32 e 48 px renderizados do mesmo arquivo; `app/apple-icon.png` ← `conceito-N-icone-app.svg` em 180 px. No conceito 2, a camada de 16 px do `favicon.ico` sai do `conceito-2-favicon-16.svg`, sem seta.
2. Cabeçalho: o wordmark de texto vira o lockup em SVG inline (22 px de corpo, tamanhos acima), com `aria-label="Encore"`.
3. Cards: o wordmark de texto do rodapé e do cabeçalho do card Básico vira o lockup como `img` (as pranchas usam 44 px de altura no story para os conceitos 1 e 3 e 30 px para o 2).
4. Design: registrar a logo escolhida no `10-design.md` (tokens, respiro, mínimos) e remover os conceitos não escolhidos daqui, se o cliente quiser.

## Depois da escolha do ângulo (8c.3, dev-frontend)

Se o cliente escolher −8° ou −16°, antes troque `GIRO` no `build-logo.mjs` e rode `node docs/projeto/design/logo/build-logo.mjs 2`.

1. **`src/components/brand/logo-art.ts`:** a estrutura não muda. Continuam os mesmos quatro paths (`word`, `bar`, `arc` com `stroke`, `head`), com `arcWidth` 13,5 e `headStroke` 1,08.
   - **Mudam** os valores do "e", copiados de `conceito-2.svg`: `gradient`, `bar`, `arc` e `head`.
   - **Ficam iguais:** `word` (o "encor" não mexe), `width` 308,3 e `height` 56, a −12° e a −8°. A −16°, `width` passa a 308,47.
2. **`logo.tsx`** e **`src/features/cards/brand.ts`:** nada muda.
3. **Testes:**
   - A comparação dos paths com `conceito-2.svg` continua valendo e pega a troca.
   - A −12°, nenhum outro número muda: `lockupWidth(56)` 308,3 e `lockupWidth(30)` 165,2, e os `viewBox` e larguras de `logo.test.tsx` e `templates.test.ts` continuam os mesmos.
   - A −16°, os testes passam a esperar `lockupWidth(56)` 308,5, `lockupWidth(30)` 165,3 e o `viewBox` `0 0 308.47 56`.
4. **Ícones:**
   - `app/icon.svg` ← `conceito-2-simbolo.svg`;
   - `app/favicon.ico`: 16 px de `conceito-2-favicon-16.svg`, e 32 e 48 px de `conceito-2-simbolo.svg`;
   - `app/apple-icon.png` ← `conceito-2-icone-app.svg` em 180 px.
5. **README e docs:**
   - `docs/readme/logo.svg` com o lockup novo;
   - `10-design.md` §16: o ângulo do "e" e a regra "não girar o logo inteiro".
6. **Alternativa com `transform`:** em vez de copiar os paths girados, dá para manter os paths da variação 3 e pôr o "e" num `<g transform="rotate(-12 278.3 28)">`, com o centro do círculo do lockup em 278,3, 28. É seguro:
   - no SVG inline do site, porque `transform` é atributo, não `style`, e passa pela CSP;
   - nos cards, porque o satori recebe o lockup como `<img>` com SVG em data URL, não interpreta esse SVG e o repassa ao resvg, que suporta `transform` em `<g>` e gira junto o degradê `userSpaceOnUse`.

   Mesmo assim, a recomendação é copiar os paths girados. Assim, o SVG do app continua igual ao `conceito-2.svg`, sem `transform`, e o teste de igualdade dos paths continua valendo sem mudança.
