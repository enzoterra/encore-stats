# Revisão de textos em linguagem do dia a dia (Iteração 8b, passo 8b.10)

Pedido do cliente (2026-09-28): tirar o jeito técnico de títulos, subtítulos e explicações, a começar pelo selo e pelo dropdown de privacidade, porque quem usa o Encore não é técnico.

- **O que mudou:** só os textos, em pt-BR e en (`src/i18n/messages/`). As chaves, o layout e a lógica continuam iguais.
- **O que não mudou:** as promessas. Cada frase diz a mesma coisa que antes, ou menos (nunca mais). Os elementos da LGPD e as atribuições do Spotify continuam no lugar.
- **Como ler:** abaixo estão os ~30 trechos mais importantes, por tela, em pt-BR (antes → depois). O inglês seguiu a mesma linha, em inglês do dia a dia.

## Nomes que passam a valer em todo lugar

| Coisa | Nome usado | Some |
|---|---|---|
| O .zip que o Spotify manda por e-mail | "o arquivo do Spotify", "o arquivo que o Spotify mandou" | ".zip" como sujeito da frase (fica só entre parênteses, para a pessoa reconhecer o arquivo) |
| O "Extended streaming history" | "seu histórico completo". O nome oficial, "Histórico de streaming estendido", só aparece onde a pessoa precisa achar a opção no Spotify | "histórico estendido" |
| Os períodos do Conectar (4 semanas, 6 meses, 1 ano) | "período" (o mesmo nome do Upload) | "janela", "janela de tempo" |
| A sessão/cookie do Conectar | "sua conexão com o Spotify" | "sessão", "cookie criptografado", "cache" (a palavra "cookie" só fica na página de privacidade, explicada) |
| Onde tudo acontece | "no seu aparelho", "nesta aba" | "navegador" (quando dá), "servidor", "Web Worker", "processamento" |
| Allowlist / Development Mode | "convidados", "fase de testes" | "allowlist", "modo de teste do app" |
| Os modos | modo Upload, modo Conectar, demo ("a demo") | "o Demo" (padronizado no feminino) |

## Selo e dropdown de privacidade (o exemplo do cliente)

| # | Antes | Depois |
|---|---|---|
| 1 | Selo (Upload): "Processado no seu aparelho" | "Tudo fica no seu aparelho" |
| 2 | Selo (Conectar): "Nada fica guardado no servidor" | "Não guardamos suas músicas" |
| 3 | Selo (Demo): "Dados fictícios · sem rede" | "Só dados inventados" |
| 4 | "O arquivo é lido no seu navegador e nunca é enviado." | "Seu arquivo é lido aqui, no seu aparelho, e não é enviado para lugar nenhum." |
| 5 | "Seu acesso ao Spotify fica num cookie criptografado; os dados, só nesta aba." | "Sua conexão com o Spotify fica salva neste aparelho, trancada de um jeito que só o Encore abre. O que vem da sua conta fica só nesta aba." |
| 6 | "Sem banco de dados, sem contas, sem analytics." | "Sem cadastro, sem rastreamento e sem guardar suas músicas com a gente." |
| 7 | "Depois de carregar, funciona offline. Teste: desligue a internet e envie o arquivo." | "O arquivo do seu histórico não passa pela internet: a conta toda é feita no seu aparelho." (a frase antiga não era verdadeira: veja o ponto 5 no fim) |
| 8 | "Código aberto: confira você mesmo" | "O código do site é público: confira você mesmo" |

## Página inicial

| # | Antes | Depois |
|---|---|---|
| 9 | "…sem enviar nada para servidor nenhum." | "…de qualquer período. E o seu histórico não sai do seu aparelho." |
| 10 | "Todos mostram o mesmo tipo de painel. Muda de onde vêm os dados." | "Os três mostram o mesmo tipo de resultado. O que muda é de onde vêm as suas músicas." |
| 11 | Conectar: "Em modo de teste: só contas convidadas (até 5)." | "Por enquanto, só para convidados (até 5 contas)." |
| 12 | "Indisponível nesta instalação" / "O dono do site não configurou o acesso ao Spotify." | "Ainda não disponível neste site" / "Quem cuida do site ainda não ligou a conexão com o Spotify." |
| 13 | "Um mapa de calor hora × dia no seu fuso…" | "Um mapa colorido dos dias e horários em que você mais ouve, no seu horário…" |
| 14 | Cards: "…prontos para os Stories. Chegam na próxima etapa." | "…prontos para os Stories, o feed ou o WhatsApp." (os cards já existem desde a Sprint 6; o "chegam na próxima etapa" estava desatualizado) |
| 15 | "Privacidade por arquitetura" | "Privacidade que vem de fábrica" |

## Pedir o histórico e enviar o arquivo

| # | Antes | Depois |
|---|---|---|
| 16 | "Quando o .zip chegar, volte aqui" / "Solte o arquivo na página de envio, sem descompactar." | "Quando o arquivo chegar, volte aqui" / "Envie o arquivo na página de envio do jeito que ele veio, sem descompactar." |
| 17 | "Baixar lembrete (.ics)" | "Baixar lembrete para a agenda" |
| 18 | "Solte o .zip que o Spotify mandou por e-mail. Ele é lido aqui mesmo, no seu navegador." | "Envie o arquivo que o Spotify mandou por e-mail. Ele é lido aqui mesmo, no seu aparelho, e não sai dele." |
| 19 | "Aceita o .zip ou os Streaming_History_Audio_*.json." | "Pode ser o arquivo do jeito que chegou (.zip) ou os arquivos "Streaming_History_Audio" que vêm dentro dele." |
| 20 | Etapas: "Descompactar · Ler · Agregar" | "Abrir · Ler · Somar" |

## Mensagens de erro do arquivo

Cada erro agora diz o que aconteceu e o que fazer. O código do erro continua no atributo `data-error-code` (invisível, útil para suporte), não no texto.

| # | Antes | Depois |
|---|---|---|
| 21 | UNSUPPORTED_FILE: "Esse tipo de arquivo não é aceito" / "…não é .zip nem .json. Envie o .zip que o Spotify mandou ou os Streaming_History_Audio_*.json." | "Esse arquivo não serve" / "…não parece ser o arquivo do Spotify. Envie o arquivo que chegou no e-mail do Spotify (o nome termina em .zip)." |
| 22 | INVALID_ZIP: "…não parece um .zip válido." | "…parece estar danificado ou não é o arquivo do Spotify. Baixe de novo pelo link do e-mail e envie sem descompactar." |
| 23 | UNSAFE_PATH: "Arquivo fora do padrão" / "…recusamos zips com caminhos suspeitos (como "../")." | "Esse arquivo tem algo estranho" / "Encontramos dentro dele uma coisa que o arquivo do Spotify não tem, então paramos por segurança. Baixe o arquivo de novo…" |
| 24 | COMPRESSION_RATIO: "…tem uma compressão suspeita (mais de 100×)." | "…cresce mais de 100 vezes ao ser aberto, muito mais que um histórico normal. Por segurança, paramos a leitura." |
| 25 | INVALID_JSON: "Um dos arquivos está corrompido" / "…não é um JSON válido." | "Uma parte do arquivo está danificada" / "Não deu para ler "…". Baixe o arquivo de novo pelo link do e-mail do Spotify." |
| 26 | INTERNAL: "O navegador não deu conta" | "O aparelho não deu conta" / "…Feche outras abas e tente de novo, ou use um computador." |

## Modo Conectar

| # | Antes | Depois |
|---|---|---|
| 27 | Aviso novo do 8b.4: "O Spotify só libera três janelas pela API: 4 semanas, 6 meses e 1 ano. […] só com o histórico completo, que o Encore lê no seu navegador." | "Pela conexão, o Spotify só mostra três períodos: 4 semanas, 6 meses e 1 ano. Para ver desde o seu primeiro play, ou um período à sua escolha, envie o seu histórico completo. Ele é lido aqui, no seu aparelho." |
| 28 | "Janela de tempo" / "Seus dados continuam em 4 semanas." | "Período" / "Você continua vendo: 4 semanas." |
| 29 | Fora da lista: "Este app ainda está em modo de teste" | "O modo Conectar ainda é só para convidados" |
| 30 | Cota: "Limite de consultas do app atingido" / "O Encore divide uma cota com todos os usuários. Volte em ~15 min." | "O Encore chegou ao limite do Spotify" / "O Spotify limita quantas vezes o Encore pode buscar dados, e esse limite vale para todo mundo que usa o site. Volte daqui a uns 15 min." |
| 31 | "Sua sessão expirou" / "…a conexão com o Spotify dura pouco." | "Sua conexão expirou" / "…a conexão com o Spotify vence de tempos em tempos." (a conexão dura até 30 dias; "dura pouco" não era exato) |
| 32 | Sair: "Sair apaga a sessão e o cache desta aba." | "Sair apaga a sua conexão e o que veio do Spotify nesta aba." |
| 33 | Rodapé: "Dados do Spotify lidos pela sua conta. O servidor não guarda nada; o cache fica só nesta aba." | "Dados do Spotify, lidos pela sua conta. O Encore não guarda nada disso: fica tudo só nesta aba." |
| 34 | Gêneros: selo "instável" | "pode sumir" / "O Spotify pode parar de mostrar os gêneros…" |

## Página de privacidade (LGPD)

A página ficou em linguagem simples, com a referência da lei curta entre parênteses. A data de atualização passou para 28 de setembro de 2026.

| # | Antes | Depois |
|---|---|---|
| 35 | "Não temos banco de dados, contas próprias, analytics nem cookies de rastreamento." | "Não pedimos cadastro, não guardamos suas músicas com a gente e não usamos ferramentas que rastreiam suas visitas." |
| 36 | "O controlador dos dados (LGPD, art. 5º, VI) é {nome}." | "Quem responde pelos seus dados aqui é {nome} (o "controlador", na LGPD, art. 5º, VI)." |
| 37 | "O processamento do arquivo acontece num Web Worker do seu navegador. No modo Conectar, o servidor do Encore apenas repassa as consultas ao Spotify…" | "Seu arquivo é lido no próprio aparelho, dentro desta página. No modo Conectar, o Encore busca as informações no Spotify por você e entrega só o que a tela precisa, sem guardar nada no caminho…" |
| 38 | "Respostas do Spotify (Conectar): na memória ou no sessionStorage da aba…" / "Cookie de sessão (Conectar): criptografado…" | "O que vem do Spotify (modo Conectar): fica só nesta aba do navegador…" / "Sua conexão com o Spotify (modo Conectar): fica salva neste navegador num cookie protegido…" |
| 39 | "Base legal" / "O tratamento serve para prestar o serviço que você pediu (LGPD, art. 7º, V)." | "Por que podemos usar esses dados" / "Usamos esses dados só para entregar o que você pediu: as suas estatísticas (é a base legal da LGPD, art. 7º, V)." |
| 40 | "Confirmação, acesso, correção, portabilidade, eliminação e informação sobre compartilhamento (LGPD, art. 18)…" | "Pela LGPD (art. 18), você pode pedir para confirmar se usamos seus dados, ver quais são, corrigir, levar para outro serviço, apagar e saber com quem foram compartilhados…" |
| 41 | "Você também pode apresentar reclamação à Autoridade Nacional de Proteção de Dados (ANPD)." | "Você também pode reclamar na Autoridade Nacional de Proteção de Dados (ANPD), o órgão do governo que fiscaliza a LGPD." |
| 42 | Cookies: "Só usamos cookies essenciais: o da sessão do modo Conectar…" | "Cookies são pequenos arquivos que um site salva no seu navegador. O Encore só usa os essenciais: um que mantém você conectado no modo Conectar…" |

### O que a LGPD exige e onde está na página nova

- [x] **Quem cuida dos dados:** seção "Quem cuida dos seus dados". Nome do controlador e e-mail (`mailto:`) vêm de `NEXT_PUBLIC_PRIVACY_CONTROLLER` e `NEXT_PUBLIC_PRIVACY_CONTACT`. Sem e-mail, o contato cai para a página do projeto.
- [x] **Dados de cada modo:** seção "Quais dados usamos".
  - Upload: campos lidos e descartados (IP e país), tudo no aparelho.
  - Conectar: perfil básico, tops, tocadas recentemente e curtidas, só para ver.
  - Demo: nenhum dado pessoal.
  - Onde cada coisa fica: seções "Onde os dados ficam" e "Por quanto tempo".
- [x] **Base legal:** seção "Por que podemos usar esses dados". Art. 7º, V, mais a autorização dada no Spotify, que pode ser retirada.
- [x] **Transferência internacional:** Vercel e Spotify podem ficar fora do Brasil (art. 33, IX), em "Onde os dados ficam".
- [x] **Registros da plataforma e prazo:** os do Encore não guardam conteúdo; os da Vercel guardam IP e página por cerca de 1 hora. Está em "Por quanto tempo".
- [x] **Direitos do titular e como pedir:** a lista do art. 18, em palavras simples, em "Seus direitos e como cancelar o acesso". O pedido vai pelo contato acima. Também explica como tirar o acesso em spotify.com/account/apps.
- [x] **ANPD:** o direito de reclamar, com o que o órgão faz.

## Regras de marca do Spotify (sem mudança)

- Continuam iguais:
  - "Encore não é afiliado nem endossado pelo Spotify.";
  - "Abrir no Spotify" / "Ouvir no Spotify";
  - "Inclui a atribuição ao Spotify.";
  - o logo nas seções do Conectar.
- Nos textos, o Spotify aparece sempre como origem dos dados ("Dados do Spotify", "do seu histórico do Spotify"), nunca como parceiro.
- Os textos que vão dentro da imagem dos cards (`Cards.strings`) não mudaram: eles seguem o `10-design.md` §9 e ficam para o passo 8b.5.

## Pontos para o cliente decidir

1. **"Upload" como nome do modo.** Mantivemos "modo Upload" e "Visão Upload", porque o nome está no cabeçalho, nas abas da demo e nos documentos. Nas frases, trocamos por "enviar seu histórico". Uma alternativa em português seria "modo Arquivo".
2. **"Cookie" na página de privacidade.** Fora dela, a palavra sumiu. Nela, ficou, com uma explicação curta, porque a lei e os leitores atentos procuram por ela.
3. **"Plays".** Mantido: é como os ouvintes falam, e é o que os cards usam. A alternativa formal seria "reproduções".
4. **"PNG" no diálogo de compartilhar** ("Baixar PNG", "PNG baixado"). Mantido por enquanto: os testes dos cards, que ficam com o passo 8b.5, verificam esses textos. Sugestão para o 8b.5: "Baixar imagem" / "Imagem baixada".
5. **A frase do "funciona offline" no selo não era verdadeira.** O selo dizia: "Depois de carregar, funciona offline. Teste: desligue a internet e envie o arquivo."
   - Fizemos esse teste no Chromium e no WebKit: abrimos /upload, desligamos a rede e enviamos o arquivo.
   - O envio **falha**, com o erro "O aparelho não deu conta". O programa que lê o arquivo só é baixado do site na hora do envio.
   - A frase também não valia para o Conectar, que sempre precisa da internet.
   - Trocamos por uma promessa que o sistema cumpre: o arquivo não passa pela internet.
   - Para voltar a prometer "funciona sem internet", é preciso mudar o código: baixar o leitor junto com a página. Aí o teste pode entrar na suíte e2e.
   - Com a rede desligada, a mensagem de erro fala em "falta de memória", o que também engana. Vale ajustar junto.
