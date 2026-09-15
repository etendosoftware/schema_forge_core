export interface TokenExchangeResult {
  jwt: string;
  expiresAt: number;
}

export class TokenExchangeService {
  constructor(
    private readonly etendoBaseUrl: string,
    private readonly fetchImpl: typeof fetch = fetch
  ) {}

  async exchangeApiKeyForJwt(clientId: string, clientSecret: string): Promise<TokenExchangeResult> {
    const body = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: clientSecret,
    });
    const response = await this.fetchImpl(`${this.etendoBaseUrl}/oauth2/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
    const json = (await response.json()) as {
      access_token?: string;
      expires_in?: number;
      error?: string;
    };
    if (!response.ok || !json.access_token) {
      throw new Error(`OAuth2 token exchange failed: ${json.error ?? response.status}`);
    }
    const now = Math.floor(Date.now() / 1000);
    return { jwt: json.access_token, expiresAt: now + (json.expires_in ?? 0) };
  }
}
