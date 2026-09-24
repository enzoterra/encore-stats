/**
 * Regras de texto dos cards (10-design.md §9.5): tudo por **grafema** (`Intl.Segmenter`), para
 * não quebrar emoji nem acento combinado. Funções puras, usadas pelos templates (worker e Node).
 */

const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });

/** Reticências como um único caractere (U+2026). */
export const ELLIPSIS = '…';
/** Espaço inquebrável: dentro de um nome do line-up, a linha nunca quebra. */
export const NBSP = ' ';

export function graphemes(value: string): string[] {
  return Array.from(segmenter.segment(value), (part) => part.segment);
}

export function graphemeLength(value: string): number {
  return graphemes(value).length;
}

/**
 * Normaliza um texto que vai para a imagem: remove caracteres de controle e de formatação
 * bidirecional (não têm glifo e podem embaralhar a linha) e junta espaços repetidos.
 */
export function cleanText(value: string): string {
  return value
    .replace(/[\p{Cc}​-‏‪-‮⁦-⁩﻿]/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim();
}

/** Corta em `max` grafemas (contando o "…"). */
export function truncate(value: string, max: number): string {
  const text = value.trim();
  const parts = graphemes(text);
  if (parts.length <= max) return text;
  return `${parts
    .slice(0, Math.max(1, max - 1))
    .join('')
    .trimEnd()}${ELLIPSIS}`;
}

/**
 * O Bricolage cobre latim, latim estendido e vietnamita. Fora disso o satori cai no Inter, que é
 * mais largo: o texto desce um degrau.
 */
export function outsideDisplayCoverage(value: string): boolean {
  return /[^ -ɏḀ-ỿ -⁯€]/u.test(value);
}

export type FontStep = { max: number; size: number };
export type Fitted = { text: string; size: number };

/**
 * Orçamento → degrau de fonte → truncamento (§9.5): usa o maior degrau cujo orçamento comporta o
 * texto; no menor degrau, trunca.
 */
export function fit(value: string, steps: readonly FontStep[]): Fitted {
  const start = outsideDisplayCoverage(value) ? Math.min(1, steps.length - 1) : 0;
  const length = graphemeLength(value);
  for (const step of steps.slice(start)) {
    if (length <= step.max) return { text: value, size: step.size };
  }
  const last = steps[steps.length - 1]!;
  return { text: truncate(value, last.max), size: last.size };
}

/** Espaços inquebráveis dentro do nome: a quebra só acontece entre nomes (nos separadores). */
export function keepTogether(value: string): string {
  return value.replace(/ /g, NBSP);
}

/**
 * Nome do arquivo (§9.7): `encore-{template}-{formato}-{periodo}.png`, com o período
 * reduzido a `[a-z0-9-]`.
 */
export function slug(value: string, fallback = 'card'): string {
  const base = value
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
    .replace(/-+$/g, '');
  return base || fallback;
}

/** "Nome no cartaz" (§9.4): até 20 grafemas, só texto. */
export const POSTER_NAME_MAX = 20;

export type PosterNameCheck = 'ok' | 'tooLong' | 'invalid';

export function checkPosterName(value: string): PosterNameCheck {
  const text = value.trim();
  if (graphemeLength(text) > POSTER_NAME_MAX) return 'tooLong';
  // Letras (com acento), números, espaço e pontuação simples. Emoji e símbolos ficam de fora:
  // as fontes do card não têm esses glifos.
  if (!/^[\p{L}\p{M}\p{N} .'’&!-]*$/u.test(text)) return 'invalid';
  return 'ok';
}
