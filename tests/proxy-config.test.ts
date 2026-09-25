import { describe, expect, it, vi } from 'vitest';

import { routing } from '@/i18n/routing';

import { config } from '../proxy';

// O middleware do next-intl importa `next/server` sem extensão, o que o Node puro (ESM) não resolve
// fora do bundler do Next. Aqui só o `config` interessa.
vi.mock('next-intl/middleware', () => ({ default: () => () => new Response(null) }));

describe('matcher do proxy', () => {
  it('a entrada de caminhos com ponto lista exatamente os locales do next-intl', () => {
    // O `config` precisa ser literal (análise estática do Next); este teste pega a divergência.
    const entry = config.matcher.find((m) => m.endsWith('/:path*'));
    const list = entry ? /^\/\((.+)\)\/:path\*$/.exec(entry)?.[1]?.split('|') : undefined;
    expect(list?.sort()).toEqual([...routing.locales].sort());
  });

  it('a entrada geral continua excluindo API, arquivos do Next e arquivos estáticos', () => {
    const general = new RegExp(`^${config.matcher[0]}$`);
    for (const path of ['/pt-BR', '/en/demo', '/nao-existe']) expect(general.test(path)).toBe(true);
    for (const path of ['/api/health', '/_next/static/x.js', '/fonts/Inter.woff2']) {
      expect(general.test(path)).toBe(false);
    }
  });
});
