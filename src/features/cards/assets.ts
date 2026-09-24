/**
 * Validação dos bytes de imagem que entram no card (capa do Conectar, ADR 9). Funções puras.
 */

/** Limite da capa: a de ~300 px do Spotify tem ~30 kB; 1 MiB cobre a de 640 px com folga. */
export const MAX_COVER_BYTES = 1024 * 1024;

export type ImageKind = 'image/jpeg' | 'image/png';

/** Identifica JPEG/PNG pelos bytes iniciais (não confia no `Content-Type`). */
export function sniffImage(bytes: Uint8Array): ImageKind | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'image/jpeg';
  }
  const png = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (bytes.length >= png.length && png.every((b, i) => bytes[i] === b)) return 'image/png';
  return null;
}

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

export function toDataUrl(kind: string, bytes: Uint8Array): string {
  return `data:${kind};base64,${bytesToBase64(bytes)}`;
}

/**
 * Só capas do `i.scdn.co` por HTTPS, com o caminho `/image/<id>` que o Spotify usa
 * (a CSP libera `connect-src` só para esse host). Qualquer outra URL cai no card tipográfico.
 */
export function isAllowedCoverUrl(value: string): boolean {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  return (
    url.protocol === 'https:' &&
    url.hostname === 'i.scdn.co' &&
    url.port === '' &&
    url.username === '' &&
    url.password === '' &&
    /^\/image\/[A-Za-z0-9]{1,128}$/.test(url.pathname) &&
    url.search === ''
  );
}
