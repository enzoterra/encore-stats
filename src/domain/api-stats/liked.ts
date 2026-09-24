import type { ArtistRef, SavedPage } from '../spotify-types';

export type LikedArtistCount = { id: string; name: string; count: number };

/**
 * Agregador incremental da varredura de curtidas (RF-18): recebe as páginas de `/me/tracks`
 * em qualquer ordem (a varredura roda com concorrência 3) e mantém só
 * `Map<artistId, {name, count}>`, sem guardar as faixas. Cada faixa conta uma vez para cada
 * artista creditado. IDs de faixa já contados são lembrados só para não contar duas vezes se
 * a biblioteca mudar durante a varredura e duas páginas se sobrepuserem.
 */
export class LikedArtistsCounter {
  private readonly counts = new Map<string, LikedArtistCount>();
  private readonly seenTracks = new Set<string>();
  private readonly seenOffsets = new Set<number>();
  private totalTracks = 0;

  /** Total informado pelo Spotify na última página. */
  get total(): number {
    return this.totalTracks;
  }

  /** Faixas distintas já contadas. */
  get processed(): number {
    return this.seenTracks.size;
  }

  /** Páginas esperadas para o `total` atual. */
  get pagesExpected(): number {
    return savedPageOffsets(this.totalTracks).length;
  }

  /** 0–1, para a barra de progresso (por páginas recebidas). */
  get progress(): number {
    const expected = this.pagesExpected;
    return expected === 0 ? 1 : Math.min(1, this.pagesReceived() / expected);
  }

  get done(): boolean {
    return this.pagesReceived() >= this.pagesExpected;
  }

  private pagesReceived(): number {
    let received = 0;
    for (const offset of savedPageOffsets(this.totalTracks)) {
      if (this.seenOffsets.has(offset)) received++;
    }
    return received;
  }

  /** Soma uma página; páginas repetidas (mesmo `offset`) são ignoradas. */
  addPage(page: SavedPage): void {
    this.totalTracks = page.total;
    if (this.seenOffsets.has(page.offset)) return;
    this.seenOffsets.add(page.offset);
    for (const item of page.items) {
      if (this.seenTracks.has(item.track.id)) continue;
      this.seenTracks.add(item.track.id);
      const unique = new Map<string, ArtistRef>(item.track.artists.map((a) => [a.id, a]));
      for (const artist of unique.values()) {
        const entry = this.counts.get(artist.id);
        if (entry) entry.count++;
        else this.counts.set(artist.id, { id: artist.id, name: artist.name, count: 1 });
      }
    }
  }

  /** Artistas com mais faixas curtidas (empate: nome, depois id). */
  top(limit = 10): LikedArtistCount[] {
    return [...this.counts.values()]
      .sort(
        (a, b) => b.count - a.count || a.name.localeCompare(b.name, 'en') || (a.id < b.id ? -1 : 1),
      )
      .slice(0, limit)
      .map((entry) => ({ ...entry }));
  }

  countFor(artistId: string): number {
    return this.counts.get(artistId)?.count ?? 0;
  }
}

/**
 * Offsets que a varredura precisa buscar (páginas de 50), dado o `total` da primeira página.
 * O BFF limita `offset` a 100 000 (03-arquitetura).
 */
export function savedPageOffsets(total: number, pageSize = 50, maxOffset = 100_000): number[] {
  const offsets: number[] = [];
  for (let offset = 0; offset < total && offset <= maxOffset; offset += pageSize) {
    offsets.push(offset);
  }
  return offsets;
}

/**
 * Artistas do top de curtidas que não aparecem no top da API (não temos imagem/gêneros
 * deles): a UI busca `/artists/{id}` só para estes, até `limit` (03: top 10, concorrência 2).
 */
export function missingArtistIds(
  liked: readonly { id: string }[],
  known: readonly { id: string }[],
  limit = 10,
): string[] {
  const knownIds = new Set(known.map((a) => a.id));
  return liked
    .slice(0, limit)
    .map((a) => a.id)
    .filter((id) => !knownIds.has(id));
}
