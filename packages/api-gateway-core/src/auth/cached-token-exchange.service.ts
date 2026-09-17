// Regular (not `import type`) import: this class is constructor-injected by
// NestJS elsewhere (gateway/src/app.module.ts), which needs `emitDecoratorMetadata`
// to reflect the real class reference for design:paramtypes — a type-only import
// erases that reference, silently breaking DI resolution at runtime (ETP-5345).
import { TokenExchangeService } from './token-exchange.service.ts';

export class CachedTokenExchangeService {
  private cache = new Map<string, { jwt: string; expiresAt: number }>();

  constructor(private readonly exchanger: TokenExchangeService) {}

  async getJwtForApiKey(apiKeyId: string, apiKeySecret: string): Promise<string> {
    const cached = this.cache.get(apiKeyId);
    const now = Math.floor(Date.now() / 1000);
    if (cached && cached.expiresAt > now) {
      return cached.jwt;
    }
    const result = await this.exchanger.exchangeApiKeyForJwt(apiKeyId, apiKeySecret);
    this.cache.set(apiKeyId, result);
    return result.jwt;
  }
}
