/**
 * Autor do Encore (portfólio, Iteração 8c.4). Dado público e fixo, por isso fica aqui e não em
 * variável de ambiente. Não confundir com o contato da LGPD de `/privacy`, que vem de
 * `NEXT_PUBLIC_PRIVACY_CONTACT`.
 */
export const AUTHOR = {
  name: 'Enzo Terra',
  email: 'enzoterra18@gmail.com',
  githubUser: 'enzoterra',
  githubUrl: 'https://github.com/enzoterra',
  siteHost: 'enzoterra.dev.br',
  siteUrl: 'https://enzoterra.dev.br',
} as const;

export const AUTHOR_MAILTO = `mailto:${AUTHOR.email}`;
