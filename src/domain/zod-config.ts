import { z } from 'zod';

/**
 * Configuração global do Zod, importada pelos módulos de schema do domínio (rodam na página, nos
 * workers e no servidor).
 *
 * `jitless`: o Zod 4 testa `new Function('')` para compilar validadores. A CSP das páginas e dos
 * workers não tem `'unsafe-eval'`, então o teste é bloqueado; o Zod captura o erro, mas o
 * navegador registra uma violação de CSP a cada contexto (Sprint 7). Sem JIT, nada de `eval` e
 * nenhuma violação; o custo de desempenho é desprezível para o volume do app.
 */
z.config({ jitless: true });

export { z };
