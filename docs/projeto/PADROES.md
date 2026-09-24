# PADRÕES do projeto Encore (leitura obrigatória de todo papel)

> Adaptação dos padrões transversais ao perfil **padrão-leve**, web fullstack leve, **sem banco, sem Docker, sem IA**.
> Antes de agir: leia `PROGRESSO.md` e retome do primeiro `[ ]` da sua sprint; marque `[x]` **assim que** concluir cada passo.

## 0. Proporcionalidade
- Qualidade de portfólio sem cerimônia corporativa: sem Docker, sem banco, sem observabilidade formal, sem IaC.
- Não adicione camadas, libs ou serviços fora de `03-arquitetura.md` sem registrar uma ADR curta e o motivo no `PROGRESSO.md`.

## 1. Privacidade (princípio nº 1 — inegociável)
- **Nunca** persistir no servidor dados de escuta, perfil ou tokens fora do cookie JWE da sessão.
- **Nunca** logar corpo de resposta, tokens, `code`/`state`, query do callback, nomes de músicas ou artistas. Use `src/server/logger.ts`, que tem allowlist de campos. `console.*` é proibido em `app/api/**`.
- O upload **nunca** sai do navegador: o worker não faz `fetch`; a CSP tem `connect-src 'self'`.
- Armazenamento no cliente: memória ou sessionStorage. **Proibido** usar localStorage ou IndexedDB para dados de escuta. Preferências, como idioma, podem ir em cookie ou localStorage.
- Respostas do BFF: `Cache-Control: private, max-age=N` + `Vary: Cookie`. **Nunca** `public` ou `s-maxage`.
- Do histórico, `ip_addr` e `conn_country` nunca são lidos (schema `strip`).

## 2. Segurança em cada camada
- Zod em toda entrada: parâmetros do BFF, respostas do Spotify, registros do histórico.
- Sem sessão → 401. Nenhuma rota aceita token ou user id vindo do cliente. O BFF só chama URLs fixas do Spotify.
- CSP com nonce (`proxy.ts`) e os cabeçalhos de `08-seguranca.md`. Sem `dangerouslySetInnerHTML`. Sem scripts de terceiros em runtime; fontes self-hosted.
- Segredos só em env (`src/server/env.ts` valida). `.env.example` sempre atualizado. Nada de segredo no repositório.
- Dependências: pnpm, `pnpm audit` sem alta/crítica, versões fixadas no lockfile.

## 3. Stack e versões (fixadas em 03)
Node 24 LTS · pnpm 12 · Next 16.3.x · React 19.3 · TypeScript 6.0 (`strict`) · Tailwind 4.3 · next-intl 4 · TanStack Query 5 · Zustand 5 · Zod 4 · fflate 0.8 · Comlink 4 · jose 6 · satori 0.33 + @resvg/resvg-wasm 2.6 · Radix UI · Vitest 5 · Playwright 1.63 + axe.
Ao instalar, confirme o patch mais recente (`pnpm view <pkg> version`). Não mude de major sem ADR.

## 4. Comandos
| Ação | Comando |
|---|---|
| Instalar | `pnpm i` |
| Rodar local | `pnpm dev` → `http://127.0.0.1:3000` |
| Lint / tipos | `pnpm lint` · `pnpm typecheck` |
| Testes | `pnpm test` (unit/integração) · `pnpm test:e2e` (Playwright) |
| Build | `pnpm build` |
| Fixtures | `pnpm fixtures` (gera `tests/fixtures/`) |

## 5. Ambiente local e "seed demo"
- `pnpm dev` sem nenhuma credencial já precisa funcionar, com Upload e Demo.
- O modo Demo é o seed: determinístico, fictício, sem rede. Testes e e2e se apoiam nele.
- O README mantém o passo a passo "como rodar" e "como cadastrar o app no Spotify / allowlist".

## 6. Código
- Lógica de domínio em funções **puras** em `src/domain` (sem React, sem DOM), testáveis em Node.
- UI em `src/features/<área>`; componentes acessíveis (Radix); textos sempre via next-intl (PT-BR e EN).
- Nomes em inglês no código; documentação e mensagens de commit em PT-BR ou EN, de forma consistente. Commits no padrão Conventional Commits.
- Erros tipados (`{ error: { code } }`); nenhum stack trace ao cliente.

## 7. UI e acessibilidade
- Fidelidade ao `10-design.md`. Mobile-first de 360 px em diante, sem scroll horizontal.
- WCAG 2.2 AA: contraste, foco visível, teclado, `prefers-reduced-motion`, gráficos com tabela equivalente.
- Branding do Spotify:
  - logo e link "Abrir no Spotify" junto a metadados vindos da API;
  - capas sem corte e sem sobreposição;
  - nunca imitar a marca do Spotify ou a do Wrapped.

## 8. Testes e DoD
Veja `07-estrategia-de-testes.md` e a DoD em `05-sprints.md`. Cobertura ≥ 80% em `src/domain`; 100% nos caminhos de segurança do BFF.

## 9. PROGRESSO.md
Protocolo da seção 8 dos padrões: retomar do primeiro `[ ]`, marcar cada passo ao concluí-lo, atualizar o "Estado atual" e, ao fechar a sprint, registrar "como verificar" e o próximo papel.
