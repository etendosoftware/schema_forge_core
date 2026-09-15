import { Injectable, type CanActivate, type ExecutionContext, UnauthorizedException } from '@nestjs/common';
import type { CachedTokenExchangeService } from '../auth/cached-token-exchange.service.ts';

@Injectable()
export class PublicApiKeyGuard implements CanActivate {
  constructor(private readonly tokenExchange: CachedTokenExchangeService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader: string | undefined = request.headers['authorization'];
    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing API key');
    }
    const [apiKeyId, apiKeySecret] = authHeader.slice('Bearer '.length).split(':');
    if (!apiKeyId || !apiKeySecret) {
      throw new UnauthorizedException('Malformed API key');
    }
    try {
      request.neoJwt = await this.tokenExchange.getJwtForApiKey(apiKeyId, apiKeySecret);
    } catch {
      throw new UnauthorizedException('Invalid API key');
    }
    return true;
  }
}
