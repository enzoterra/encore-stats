/**
 * Módulo vazio para o `require('fs')` do harfbuzzjs no bundle do navegador (alias em
 * `next.config.ts`). O código só chama `fs` quando roda no Node, então nada daqui é usado.
 */
const empty = {};
export default empty;
