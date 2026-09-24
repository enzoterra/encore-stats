/* eslint-disable @next/next/no-img-element -- Os arquivos oficiais do Spotify são exibidos como
   estão (sem otimização nem redimensionamento pelo next/image, que também gera `style` no SSR,
   bloqueado pela CSP). */
import { cn } from '@/components/ui/cn';

/**
 * Logos oficiais do Spotify (10-design.md §10), baixados sem alteração dos pacotes das
 * Spotify Design Guidelines (developer.spotify.com/documentation/design):
 * - `2024-spotify-full-logo.zip` → `Full_Logo_White_RGB.svg` (logo completo, branco);
 * - `2024-spotify-logo-icon.zip` → `Primary_Logo_White_RGB.svg` (ícone, branco).
 * Sempre a versão branca sobre fundo escuro liso, nunca recolorida, esticada ou sobre capa.
 */
export const SPOTIFY_FULL_LOGO = '/brand/spotify-full-logo-white.svg';
export const SPOTIFY_ICON = '/brand/spotify-icon-white.svg';

/** Proporção do logo completo oficial (viewBox 823,46 × 225,25). */
const FULL_RATIO = 823.46 / 225.25;
const ICON_RATIO = 236.05 / 225.25;

/**
 * Logo completo, 21 px de altura (≈ 77 px de largura, acima do mínimo de 70 px). Fica sozinho no
 * cabeçalho da seção, com área de proteção ≥ 12 px, nunca dentro de uma frase.
 */
export function SpotifyLogo({ className, height = 21 }: { className?: string; height?: number }) {
  return (
    <img
      src={SPOTIFY_FULL_LOGO}
      alt="Spotify"
      width={Math.round(height * FULL_RATIO)}
      height={height}
      className={cn('shrink-0 select-none', className)}
      draggable={false}
      data-testid="spotify-logo"
    />
  );
}

/** Só o ícone (≥ 21 px), para o link de cada linha, onde o logo completo não cabe. */
export function SpotifyIcon({ className, size = 21 }: { className?: string; size?: number }) {
  return (
    <img
      src={SPOTIFY_ICON}
      alt=""
      aria-hidden="true"
      width={Math.round(size * ICON_RATIO)}
      height={size}
      className={cn('shrink-0 select-none', className)}
      draggable={false}
    />
  );
}
