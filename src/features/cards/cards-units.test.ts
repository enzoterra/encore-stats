import { describe, expect, it } from 'vitest';

import { bytesToBase64, isAllowedCoverUrl, MAX_COVER_BYTES, sniffImage, toDataUrl } from './assets';
import {
  checkPosterName,
  cleanText,
  ELLIPSIS,
  fit,
  graphemeLength,
  keepTogether,
  NBSP,
  outsideDisplayCoverage,
  slug,
  truncate,
} from './text';

describe('texto dos cards (10-design.md §9.5)', () => {
  it('conta e trunca por grafema, sem quebrar emoji nem acento combinado', () => {
    expect(graphemeLength('👩‍👩‍👧‍👦ab')).toBe(3);
    expect(graphemeLength('José')).toBe(4);
    expect(truncate('Farol Aceso às Três da Manhã', 23)).toBe(`Farol Aceso às Três da${ELLIPSIS}`);
    expect(graphemeLength(truncate('Farol Aceso às Três da Manhã', 23))).toBeLessThanOrEqual(23);
    expect(truncate('👩‍👩‍👧‍👦👩‍👩‍👧‍👦👩‍👩‍👧‍👦', 2)).toBe(`👩‍👩‍👧‍👦${ELLIPSIS}`);
    expect(truncate('  Curto  ', 10)).toBe('Curto');
    // Sem espaço antes das reticências.
    expect(truncate('Uma Música Com Título', 5)).toBe(`Uma${ELLIPSIS}`);
  });

  it('escolhe o maior degrau que comporta o texto e trunca no menor', () => {
    const steps = [
      { max: 10, size: 128 },
      { max: 14, size: 104 },
      { max: 18, size: 84 },
      { max: 24, size: 64 },
    ];
    expect(fit('Lua Vermelha', steps)).toEqual({ text: 'Lua Vermelha', size: 104 });
    expect(fit('Marina Sal', steps)).toEqual({ text: 'Marina Sal', size: 128 });
    const long = fit('Orquestra Sinfônica de Garagem do Bairro Alto', steps);
    expect(long.size).toBe(64);
    expect(graphemeLength(long.text)).toBeLessThanOrEqual(24);
    expect(long.text.endsWith(ELLIPSIS)).toBe(true);
  });

  it('nomes fora da cobertura do Bricolage descem um degrau (caem no Inter)', () => {
    expect(outsideDisplayCoverage('Жанна Агузарова')).toBe(true);
    expect(outsideDisplayCoverage('Ñandú & Los Çãopeões')).toBe(false);
    expect(outsideDisplayCoverage('Sơn Tùng')).toBe(false);
    const steps = [
      { max: 20, size: 100 },
      { max: 30, size: 80 },
    ];
    expect(fit('Жанна', steps).size).toBe(80);
    expect(fit('Жанна', [{ max: 20, size: 100 }]).size).toBe(100);
  });

  it('mantém cada nome do line-up inteiro (espaço inquebrável)', () => {
    expect(keepTogether('COLETIVO SAMAMBAIA')).toBe(`COLETIVO${NBSP}SAMAMBAIA`);
  });

  it('limpa controles e bidi e junta espaços', () => {
    expect(cleanText(' Ana‮  Trovão\n\t')).toBe('Ana Trovão');
  });

  it('gera o nome do arquivo só com [a-z0-9-]', () => {
    expect(slug('2024')).toBe('2024');
    expect(slug('Dez. de 2024')).toBe('dez-de-2024');
    expect(slug('Últimos 6 meses')).toBe('ultimos-6-meses');
    expect(slug('1 de mar. – 5 de abr. de 2024')).toBe('1-de-mar-5-de-abr-de-2024');
    expect(slug('!!!', 'periodo')).toBe('periodo');
    expect(slug('a'.repeat(80))).toHaveLength(40);
  });

  it('valida o "Nome no cartaz": até 20 grafemas, só texto', () => {
    expect(checkPosterName('')).toBe('ok');
    expect(checkPosterName('Maria Eduarda')).toBe('ok');
    expect(checkPosterName("D'Ávila & Cia!")).toBe('ok');
    expect(checkPosterName('a'.repeat(20))).toBe('ok');
    expect(checkPosterName('a'.repeat(21))).toBe('tooLong');
    expect(checkPosterName('<script>')).toBe('invalid');
    expect(checkPosterName('Festa 🎉')).toBe('invalid');
    expect(checkPosterName('https://x.y/z')).toBe('invalid');
  });
});

describe('capa do Conectar (ADR 9)', () => {
  it('só aceita capas do i.scdn.co por HTTPS, com caminho /image/<id>', () => {
    expect(
      isAllowedCoverUrl('https://i.scdn.co/image/ab67616d00001e02baf89eb11ec7c657805d2da0'),
    ).toBe(true);
    expect(isAllowedCoverUrl('https://i.scdn.co/image/mockt1')).toBe(true);
    for (const url of [
      'http://i.scdn.co/image/abc',
      'https://i.scdn.co.evil.com/image/abc',
      'https://evil.com/image/abc',
      'https://mosaic.scdn.co/image/abc',
      'https://image-cdn-ak.spotifycdn.com/image/abc',
      'https://i.scdn.co:8443/image/abc',
      'https://user:pw@i.scdn.co/image/abc',
      'https://i.scdn.co/image/abc?x=1',
      'https://i.scdn.co/image/../../etc',
      'https://i.scdn.co/other/abc',
      'javascript:alert(1)',
      'nada',
    ]) {
      expect(isAllowedCoverUrl(url), url).toBe(false);
    }
  });

  it('reconhece JPEG e PNG pelos bytes, não pelo cabeçalho', () => {
    expect(sniffImage(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe('image/jpeg');
    expect(sniffImage(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0]))).toBe(
      'image/png',
    );
    expect(sniffImage(new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"/>'))).toBe(
      null,
    );
    expect(sniffImage(new Uint8Array())).toBe(null);
    expect(MAX_COVER_BYTES).toBe(1024 * 1024);
  });

  it('codifica em base64 em blocos (imagens grandes não estouram a pilha)', () => {
    const bytes = new Uint8Array(200_000).map((_, i) => i % 256);
    expect(bytesToBase64(bytes)).toBe(Buffer.from(bytes).toString('base64'));
    expect(toDataUrl('image/png', new Uint8Array([1, 2, 3]))).toBe('data:image/png;base64,AQID');
  });
});
