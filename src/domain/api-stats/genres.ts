export type GenreShare = {
  genre: string;
  /** Soma dos pesos dos artistas que têm o gênero. */
  weight: number;
  /** `weight` ÷ soma dos pesos de todos os gêneros (0–1). */
  share: number;
  /** Quantos artistas do top têm o gênero. */
  artists: number;
};

export type GenreSummary = {
  genres: GenreShare[];
  /** Gêneros distintos encontrados. */
  distinct: number;
  /** A seção só aparece com pelo menos `minGenres` gêneros (RF-19). */
  visible: boolean;
};

export type GenreOptions = { limit?: number; minGenres?: number };

/**
 * Gêneros ponderados pelo rank de `/me/top/artists` (RF-19, ADR 7): num top de N artistas,
 * o artista na posição i (0-based) pesa N − i, e o peso é somado a cada um dos seus gêneros.
 * Gêneros são normalizados (trim + minúsculas); o campo é *deprecated* no Spotify, então
 * listas vazias são esperadas e a seção fica oculta.
 */
export function computeGenres(
  artists: readonly { genres: readonly string[] }[],
  options: GenreOptions = {},
): GenreSummary {
  const limit = options.limit ?? 10;
  const minGenres = options.minGenres ?? 3;
  const n = artists.length;
  const acc = new Map<string, { weight: number; artists: number }>();
  artists.forEach((artist, index) => {
    const weight = n - index;
    const unique = new Set(artist.genres.map((g) => g.trim().toLowerCase()).filter(Boolean));
    for (const genre of unique) {
      const entry = acc.get(genre) ?? { weight: 0, artists: 0 };
      entry.weight += weight;
      entry.artists += 1;
      acc.set(genre, entry);
    }
  });
  const total = [...acc.values()].reduce((sum, entry) => sum + entry.weight, 0);
  const genres = [...acc.entries()]
    .map(([genre, entry]) => ({
      genre,
      weight: entry.weight,
      share: entry.weight / total,
      artists: entry.artists,
    }))
    .sort((a, b) => b.weight - a.weight || b.artists - a.artists || (a.genre < b.genre ? -1 : 1))
    .slice(0, limit);
  return { genres, distinct: acc.size, visible: acc.size >= minGenres };
}
