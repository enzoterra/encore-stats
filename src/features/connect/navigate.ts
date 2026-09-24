/** Navegação completa (recarrega a rota no servidor). Isolada para os testes trocarem. */
export function replaceLocation(url: string): void {
  window.location.replace(url);
}
