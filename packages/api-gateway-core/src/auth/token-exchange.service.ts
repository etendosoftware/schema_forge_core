export interface TokenExchangeResult {
  jwt: string;
  /**
   * Absolute expiry, in epoch seconds. Equals the exchange time when Etendo sent no usable
   * `expires_in`, so a consumer that honours it never reuses a token of unknown lifetime.
   */
  expiresAt: number;
}

export interface TokenExchangeOptions {
  /** Abort the call to `/oauth2/token` after this many milliseconds (0 disables). Default 10 s. */
  timeoutMs?: number;
}

export const DEFAULT_TOKEN_EXCHANGE_TIMEOUT_MS = 10_000;

/**
 * Etendo refused the credential: it answered the token endpoint with 400, 401 or 403. For the
 * client_credentials grant `OAuth2Servlet` answers 401 `invalid_client` for an unknown,
 * inactive or deleted key and for a wrong secret, and 400 `invalid_request` / `invalid_scope`
 * for a malformed request. Retrying with the same credential will not help.
 */
export class InvalidApiKeyError extends Error {
  constructor(
    readonly status: number,
    readonly oauthError?: string
  ) {
    super(`OAuth2 token exchange refused the credential (${oauthError ?? status})`);
    this.name = 'InvalidApiKeyError';
  }
}

/**
 * The credential could not be checked: network failure, timeout, any status other than
 * 400/401/403 (a 5xx, or a 404/405/429... from a misconfigured token URL or a proxy), or a
 * response that is not a usable token. Says nothing about whether the credential is valid.
 */
export class TokenExchangeUnavailableError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    options?: { cause?: unknown }
  ) {
    super(message, options);
    this.name = 'TokenExchangeUnavailableError';
  }
}

/**
 * The only statuses that mean "this credential is wrong". Any other 4xx (404, 405, 408, 429...)
 * points at the gateway's configuration or a proxy, and must not blame every key with a 401.
 */
const CREDENTIAL_REFUSED_STATUSES = new Set([400, 401, 403]);

export class TokenExchangeService {
  private readonly timeoutMs: number;

  constructor(
    private readonly etendoBaseUrl: string,
    private readonly fetchImpl: typeof fetch = fetch,
    options: TokenExchangeOptions = {}
  ) {
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TOKEN_EXCHANGE_TIMEOUT_MS;
  }

  async exchangeApiKeyForJwt(clientId: string, clientSecret: string): Promise<TokenExchangeResult> {
    const body = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: clientSecret,
    });
    let response: Response;
    try {
      response = await this.fetchImpl(`${this.etendoBaseUrl}/oauth2/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
        // Never follow a redirect: it would re-send client_secret to wherever it points.
        // fetch rejects instead, which surfaces below as TokenExchangeUnavailableError.
        redirect: 'error',
        ...(this.timeoutMs > 0 ? { signal: AbortSignal.timeout(this.timeoutMs) } : {}),
      });
    } catch (cause) {
      throw new TokenExchangeUnavailableError('OAuth2 token endpoint unreachable', undefined, { cause });
    }

    const json = await readJsonObject(response);
    const status = response.status;
    if (CREDENTIAL_REFUSED_STATUSES.has(status)) {
      throw new InvalidApiKeyError(status, typeof json?.error === 'string' ? json.error : undefined);
    }
    if (!response.ok) {
      throw new TokenExchangeUnavailableError(`OAuth2 token endpoint answered ${status}`, status);
    }
    if (typeof json?.access_token !== 'string' || json.access_token.length === 0) {
      throw new TokenExchangeUnavailableError('OAuth2 token endpoint returned no access token', status);
    }
    const now = Math.floor(Date.now() / 1000);
    return { jwt: json.access_token, expiresAt: now + toLifetimeSeconds(json.expires_in) };
  }
}

type TokenResponseBody = { access_token?: unknown; expires_in?: unknown; error?: unknown };

/** The parsed body, or null when it is not a JSON object (an HTML error page, a cut-off body). */
async function readJsonObject(response: Response): Promise<TokenResponseBody | null> {
  try {
    const parsed: unknown = await response.json();
    return parsed !== null && typeof parsed === 'object' ? (parsed as TokenResponseBody) : null;
  } catch {
    return null;
  }
}

/** A positive whole number of seconds, or 0 for anything else (missing, zero, negative, junk). */
function toLifetimeSeconds(expiresIn: unknown): number {
  const seconds = typeof expiresIn === 'string' ? Number(expiresIn) : expiresIn;
  return typeof seconds === 'number' && Number.isFinite(seconds) && seconds > 0 ? Math.floor(seconds) : 0;
}
