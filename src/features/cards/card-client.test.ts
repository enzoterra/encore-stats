import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const comlink = vi.hoisted(() => {
  const api = {
    init: vi.fn(async () => undefined),
    isReady: vi.fn(() => true),
    render: vi.fn(async () => ({ png: new Uint8Array([0x89, 0x50, 0x4e, 0x47]), ms: 321 })),
  };
  return {
    api,
    wrap: vi.fn(() => api),
    transfer: vi.fn<(value: unknown, buffers: ArrayBuffer[]) => unknown>((value) => value),
  };
});
vi.mock('comlink', () => ({ wrap: comlink.wrap, transfer: comlink.transfer }));

class FakeWorker {
  static created = 0;
  listeners: Record<string, (() => void)[]> = {};
  terminated = false;
  constructor() {
    FakeWorker.created++;
  }
  addEventListener(type: string, listener: () => void) {
    (this.listeners[type] ??= []).push(listener);
  }
  terminate() {
    this.terminated = true;
  }
}

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 9, 9]);
const COVER = 'https://i.scdn.co/image/ab67616d00001e02baf89eb11ec7c657805d2da0';

let fetchMock: ReturnType<typeof vi.fn>;

async function load() {
  vi.resetModules();
  return import('./card-client');
}

beforeEach(() => {
  FakeWorker.created = 0;
  vi.stubGlobal('Worker', FakeWorker);
  fetchMock = vi.fn(
    async (url: string | URL) => new Response(new Uint8Array([String(url).length])),
  );
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('capa do Conectar (ADR 9)', () => {
  it('fora da allowlist não faz requisição', async () => {
    const { loadCover } = await load();
    expect(await loadCover(undefined)).toBeUndefined();
    expect(await loadCover('https://evil.com/image/x')).toBeUndefined();
    expect(await loadCover('https://image-cdn-ak.spotifycdn.com/image/x')).toBeUndefined();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('busca direto do i.scdn.co, sem cookie nem referrer, e guarda na sessão', async () => {
    fetchMock.mockResolvedValue(new Response(JPEG, { headers: { 'content-type': 'image/jpeg' } }));
    const { loadCover } = await load();
    const first = await loadCover(COVER);
    expect(first).toBe(`data:image/jpeg;base64,${Buffer.from(JPEG).toString('base64')}`);
    expect(fetchMock).toHaveBeenCalledWith(
      COVER,
      expect.objectContaining({ mode: 'cors', credentials: 'omit', referrerPolicy: 'no-referrer' }),
    );
    expect(await loadCover(COVER)).toBe(first);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['status de erro', () => new Response(PNG, { status: 404 })],
    [
      'Content-Length acima do limite',
      () => new Response(PNG, { headers: { 'content-length': String(2 * 1024 * 1024) } }),
    ],
    ['corpo acima do limite', () => new Response(new Uint8Array(1024 * 1024 + 1).fill(0xff))],
    ['formato que não é JPEG/PNG', () => new Response('<svg xmlns="http://www.w3.org/2000/svg"/>')],
  ])('%s → card tipográfico (undefined)', async (_label, response) => {
    fetchMock.mockImplementation(async () => response());
    const { loadCover } = await load();
    expect(await loadCover(COVER)).toBeUndefined();
  });

  it('falha de rede/CORS não quebra e não fica em cache', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    const { loadCover } = await load();
    expect(await loadCover(COVER)).toBeUndefined();
    fetchMock.mockResolvedValueOnce(new Response(PNG));
    await vi.waitFor(async () =>
      expect(await loadCover(COVER)).toMatch(/^data:image\/png;base64,/),
    );
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe('logo do Spotify', () => {
  it('vem do próprio site e vira data URL; falha pode ser repetida', async () => {
    const { loadSpotifyLogo } = await load();
    fetchMock.mockResolvedValueOnce(new Response('x', { status: 500 }));
    await expect(loadSpotifyLogo()).rejects.toThrow();
    fetchMock.mockResolvedValueOnce(new Response('<svg/>'));
    expect(await loadSpotifyLogo()).toBe(
      `data:image/svg+xml;base64,${Buffer.from('<svg/>').toString('base64')}`,
    );
    expect(fetchMock).toHaveBeenLastCalledWith('/brand/spotify-full-logo-white.svg', {
      credentials: 'same-origin',
    });
  });
});

describe('worker de cards', () => {
  it('um worker por aba: baixa fontes e WASM uma vez e transfere os buffers', async () => {
    const { generateCard, warmUpCards } = await load();
    warmUpCards();
    const card = await generateCard({
      template: 'festival',
      format: 'story',
      mode: 'demo',
      data: {
        locale: 'pt-BR',
        t: {} as never,
        periodLabel: '2024',
        topArtists: ['A'],
        topTracks: [],
        stats: [],
        trackStats: [],
        mixStats: [],
      },
    });
    await generateCard({
      template: 'basic',
      format: 'square',
      mode: 'demo',
      data: {
        locale: 'pt-BR',
        t: {} as never,
        periodLabel: '2024',
        topArtists: ['A'],
        topTracks: [],
        stats: [],
        trackStats: [],
        mixStats: [],
      },
    });
    expect(FakeWorker.created).toBe(1);
    expect(comlink.api.init).toHaveBeenCalledTimes(1);
    const urls = fetchMock.mock.calls.map(([url]) => String(url));
    expect(urls.filter((url) => url.endsWith('.wasm'))).toHaveLength(2);
    expect(urls.filter((url) => url.startsWith('/fonts/ttf/'))).toHaveLength(6);
    expect(urls.every((url) => !/^https?:\/\//.test(url) || url.startsWith('file:'))).toBe(true);
    const [assets, buffers] = [
      comlink.transfer.mock.calls[0]![0] as { fonts: unknown[] },
      comlink.transfer.mock.calls[0]![1] as ArrayBuffer[],
    ];
    expect(assets.fonts).toHaveLength(6);
    expect(buffers).toHaveLength(8);
    expect(card).toMatchObject({ width: 1080, height: 1920, renderMs: 321 });
    expect(card.blob.type).toBe('image/png');
  });

  it('se os arquivos não carregam, o worker é descartado e a próxima tentativa recomeça', async () => {
    fetchMock.mockResolvedValueOnce(new Response('', { status: 503 }));
    const { generateCard } = await load();
    const request = {
      template: 'festival' as const,
      format: 'square' as const,
      mode: 'upload' as const,
      data: {
        locale: 'en',
        t: {} as never,
        periodLabel: 'x',
        topArtists: [],
        topTracks: [],
        stats: [],
        trackStats: [],
        mixStats: [],
      },
    };
    await expect(generateCard(request)).rejects.toThrow('asset 503');
    await expect(generateCard(request)).resolves.toMatchObject({ height: 1080 });
    expect(FakeWorker.created).toBe(2);
  });
});
