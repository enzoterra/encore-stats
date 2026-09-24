/**
 * Mock local do Spotify (Accounts + Web API) para testar o modo Conectar sem conta real e para
 * os e2e do Conectar (Sprint 5). Tudo fictício e em memória.
 *
 * Uso:
 *   node scripts/spotify-mock-server.ts            # escuta em http://127.0.0.1:4010
 *   MOCK_SPOTIFY_PORT=4011 node scripts/spotify-mock-server.ts
 *
 * E o app com (em `.env.local` ou no ambiente; o `env.ts` só aceita loopback e fora da Vercel):
 *   SPOTIFY_ACCOUNTS_BASE=http://127.0.0.1:4010
 *   SPOTIFY_API_BASE=http://127.0.0.1:4010/v1
 *
 * Comportamento:
 * - `GET /authorize` aprova na hora e volta para a `redirect_uri` com `code` e `state`;
 *   com `MOCK_SPOTIFY_DENY=1`, volta com `error=access_denied`.
 * - `POST /api/token` confere Basic auth, `redirect_uri` e o PKCE (S256) e emite tokens de
 *   1 h (`MOCK_SPOTIFY_EXPIRES_IN` troca a validade); o refresh devolve um refresh token novo.
 * - `MOCK_SPOTIFY_FORBIDDEN=1` responde 403 em toda a Web API (conta fora da allowlist).
 */
import { createHash, randomBytes } from 'node:crypto';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';

const PORT = Number(process.env.MOCK_SPOTIFY_PORT ?? 4010);
const EXPIRES_IN = Number(process.env.MOCK_SPOTIFY_EXPIRES_IN ?? 3600);
const DENY = process.env.MOCK_SPOTIFY_DENY === '1';
const FORBIDDEN = process.env.MOCK_SPOTIFY_FORBIDDEN === '1';

const pendingCodes = new Map<string, { challenge: string; redirectUri: string }>();
const accessTokens = new Set<string>();
const refreshTokens = new Set<string>();

const id = (prefix: string, n: number) => `${prefix}${n}`.padEnd(22, 'x').slice(0, 22);
const image = (seed: string) => [
  { url: `https://i.scdn.co/image/mock${seed}`, width: 300, height: 300 },
];
const artist = (n: number) => ({
  id: id('mockartist', n),
  name: `Banda Fictícia ${n}`,
  genres: ['indie fictício', n % 2 ? 'rock imaginário' : 'pop de mentira'],
  images: image(`a${n}`),
});
const track = (n: number) => ({
  id: id('mocktrack', n),
  name: `Faixa Inventada ${n}`,
  artists: [{ id: id('mockartist', (n % 10) + 1), name: `Banda Fictícia ${(n % 10) + 1}` }],
  album: { id: id('mockalbum', n), name: `Disco ${n}`, images: image(`al${n}`) },
});
const range = (count: number, offset = 0) =>
  Array.from({ length: count }, (_, i) => offset + i + 1);

const SAVED_TOTAL = 120;

function send(res: ServerResponse, status: number, body?: unknown, headers = {}) {
  res.writeHead(status, {
    ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
    ...headers,
  });
  res.end(body === undefined ? undefined : JSON.stringify(body));
}

async function readBody(req: IncomingMessage): Promise<URLSearchParams> {
  let raw = '';
  for await (const chunk of req) raw += String(chunk);
  return new URLSearchParams(raw);
}

function issueTokens() {
  const at = `mock-at-${randomBytes(12).toString('hex')}`;
  const rt = `mock-rt-${randomBytes(12).toString('hex')}`;
  accessTokens.add(at);
  refreshTokens.add(rt);
  return {
    access_token: at,
    token_type: 'Bearer',
    expires_in: EXPIRES_IN,
    refresh_token: rt,
    scope: 'user-top-read user-read-recently-played user-library-read',
  };
}

async function handle(req: IncomingMessage, res: ServerResponse) {
  const url = new URL(req.url ?? '/', `http://127.0.0.1:${PORT}`);

  if (req.method === 'GET' && url.pathname === '/authorize') {
    const redirect = new URL(url.searchParams.get('redirect_uri') ?? '');
    redirect.searchParams.set('state', url.searchParams.get('state') ?? '');
    if (DENY) {
      redirect.searchParams.set('error', 'access_denied');
    } else {
      const code = `mock-code-${randomBytes(8).toString('hex')}`;
      pendingCodes.set(code, {
        challenge: url.searchParams.get('code_challenge') ?? '',
        redirectUri: url.searchParams.get('redirect_uri') ?? '',
      });
      redirect.searchParams.set('code', code);
    }
    return send(res, 302, undefined, { Location: redirect.toString() });
  }

  if (req.method === 'POST' && url.pathname === '/api/token') {
    if (!req.headers.authorization?.startsWith('Basic ')) {
      return send(res, 401, { error: 'invalid_client' });
    }
    const form = await readBody(req);
    if (form.get('grant_type') === 'authorization_code') {
      const pending = pendingCodes.get(form.get('code') ?? '');
      pendingCodes.delete(form.get('code') ?? '');
      const challenge = createHash('sha256')
        .update(form.get('code_verifier') ?? '')
        .digest('base64url');
      if (
        !pending ||
        pending.challenge !== challenge ||
        pending.redirectUri !== form.get('redirect_uri')
      ) {
        return send(res, 400, { error: 'invalid_grant' });
      }
      return send(res, 200, issueTokens());
    }
    if (form.get('grant_type') === 'refresh_token') {
      const rt = form.get('refresh_token') ?? '';
      if (!refreshTokens.delete(rt)) return send(res, 400, { error: 'invalid_grant' });
      return send(res, 200, issueTokens());
    }
    return send(res, 400, { error: 'unsupported_grant_type' });
  }

  if (url.pathname.startsWith('/v1/')) {
    const token = req.headers.authorization?.replace(/^Bearer /, '') ?? '';
    if (!accessTokens.has(token)) return send(res, 401, { error: { status: 401 } });
    if (FORBIDDEN) {
      res.writeHead(403);
      return res.end(
        'Check settings on developer.spotify.com/dashboard, the user may not be registered.',
      );
    }
    const path = url.pathname.slice('/v1'.length);
    if (path === '/me') {
      return send(res, 200, { id: 'mock-user', display_name: 'Pessoa Fictícia', images: [] });
    }
    if (path === '/me/top/artists') return send(res, 200, { items: range(20).map(artist) });
    if (path === '/me/top/tracks') return send(res, 200, { items: range(20).map(track) });
    if (path === '/me/player/recently-played') {
      return send(res, 200, {
        items: range(10).map((n) => ({
          track: track(n),
          played_at: new Date(Date.now() - n * 600_000).toISOString(),
        })),
      });
    }
    if (path === '/me/tracks') {
      const offset = Number(url.searchParams.get('offset') ?? 0);
      const limit = Number(url.searchParams.get('limit') ?? 20);
      const count = Math.max(0, Math.min(limit, SAVED_TOTAL - offset));
      return send(res, 200, {
        total: SAVED_TOTAL,
        offset,
        items: range(count, offset).map((n) => ({
          added_at: new Date(Date.UTC(2025, 0, 1) + n * 86_400_000).toISOString(),
          track: track(n),
        })),
      });
    }
    const artistMatch = /^\/artists\/([A-Za-z0-9]{22})$/.exec(path);
    if (artistMatch) {
      const n = Number(/(\d+)/.exec(artistMatch[1] ?? '')?.[1] ?? 1);
      return send(res, 200, artist(n));
    }
  }

  return send(res, 404, { error: { status: 404, message: 'mock: rota desconhecida' } });
}

createServer((req, res) => {
  handle(req, res).catch(() => send(res, 500, { error: { status: 500 } }));
}).listen(PORT, '127.0.0.1', () => {
  process.stdout.write(`Mock do Spotify em http://127.0.0.1:${PORT}\n`);
});
