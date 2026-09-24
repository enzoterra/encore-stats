import 'server-only';

import { ApiError } from './api-errors';
import type { SpotifyConfig } from './env';
import { log } from './logger';
import type { SessionData } from './session';
import { refreshSession } from './spotify-auth';
import { upstreamFetch, withRetry } from './upstream';

/**
 * Cliente da Web API do Spotify para UMA requisição do BFF, em nome do dono da sessão.
 *
 * - Só chama caminhos fixos montados pelas rotas (`/me`, `/me/top/{type}`, …) sobre a base
 *   configurada; nada vindo do cliente vira host ou caminho livre (SSRF).
 * - Renova o access token quando faltam menos de 60 s (ou se a API responder 401) e marca a
 *   sessão como alterada para que a rota ressele o cookie. Um novo `refresh_token` substitui o antigo.
 * - `invalid_grant` no refresh: se o access token atual ainda vale, segue com ele (outra
 *   requisição paralela provavelmente já renovou); se não, `UNAUTHENTICATED` + apagar o cookie.
 * - 403 → `NOT_ALLOWLISTED`: em Development Mode, o Spotify responde 403 ("the user may not be
 *   registered") para contas fora do User Management. Com os escopos fixos, é a única causa
 *   esperada.
 */

export const REFRESH_WINDOW_S = 60;
/** Margem mínima para ainda usar o access token atual depois de um `invalid_grant`. */
const STILL_VALID_MARGIN_S = 5;

function nowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

export class SpotifyUserClient {
  private current: SessionData;
  private refreshed = false;

  constructor(
    private readonly config: SpotifyConfig,
    session: SessionData,
  ) {
    this.current = session;
  }

  /** Sessão atual (possivelmente renovada durante a requisição). */
  get session(): SessionData {
    return this.current;
  }

  /** `true` se o access token foi renovado e o cookie precisa ser resselado. */
  get sessionChanged(): boolean {
    return this.refreshed;
  }

  private async refresh(tolerateInvalidGrant: boolean): Promise<void> {
    try {
      this.current = await refreshSession(this.config, this.current);
      this.refreshed = true;
    } catch (error) {
      const stillValid = this.current.exp - nowSeconds() > STILL_VALID_MARGIN_S;
      if (
        tolerateInvalidGrant &&
        stillValid &&
        error instanceof ApiError &&
        error.reason === 'invalid_grant'
      ) {
        log('warn', 'spotify.refresh', { outcome: 'invalid_grant_tolerated' });
        return;
      }
      throw error;
    }
  }

  /** GET na Web API; devolve o corpo JSON já parseado (ainda não validado). */
  async get(path: `/${string}`, query: Record<string, string> = {}): Promise<unknown> {
    if (this.current.exp - nowSeconds() < REFRESH_WINDOW_S) await this.refresh(true);

    const url = new URL(`${this.config.apiBase}${path}`);
    for (const [key, value] of Object.entries(query)) url.searchParams.set(key, value);

    let response = await this.request(url);
    if (response.status === 401 && !this.refreshed) {
      await this.refresh(false);
      response = await this.request(url);
    }

    const { status } = response;
    if (status >= 200 && status < 300) {
      if (response.body === undefined) {
        throw new ApiError('UPSTREAM', { upstreamStatus: status, reason: 'invalid_response' });
      }
      return response.body;
    }
    if (status === 401) {
      throw new ApiError('UNAUTHENTICATED', {
        clearSession: true,
        upstreamStatus: 401,
        reason: 'token_rejected',
      });
    }
    if (status === 403) {
      throw new ApiError('NOT_ALLOWLISTED', { upstreamStatus: 403, reason: 'forbidden' });
    }
    if (status === 404) {
      throw new ApiError('NOT_FOUND', { upstreamStatus: 404, reason: 'not_found' });
    }
    throw new ApiError('UPSTREAM', { upstreamStatus: status, reason: 'unexpected_status' });
  }

  private request(url: URL) {
    return withRetry(() =>
      upstreamFetch(url, {
        method: 'GET',
        headers: { Authorization: `Bearer ${this.current.at}`, Accept: 'application/json' },
      }),
    );
  }
}
