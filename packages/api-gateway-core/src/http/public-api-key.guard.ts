import { Injectable, type CanActivate, type ExecutionContext, UnauthorizedException } from '@nestjs/common';
// Regular (not `import type`) import — see cached-token-exchange.service.ts for why:
// constructor-injected types must be real imports for emitDecoratorMetadata (ETP-5345).
import { CachedTokenExchangeService } from '../auth/cached-token-exchange.service.ts';

@Injectable()
export class PublicApiKeyGuard implements CanActivate {
  constructor(private readonly tokenExchange: CachedTokenExchangeService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader: string | undefined = request.headers['authorization'];
    // Match `\s+` rather than slicing off a fixed 7 characters ('Bearer ') —
    // some clients (e.g. Scalar's "try it out" UI) send extra whitespace after
    // "Bearer", and a fixed-length slice leaves a leading space glued onto
    // apiKeyId, which fails the token exchange and surfaces as a misleading
    // "Invalid API key" for a key that was actually fine (ETP-5345).
    const match = authHeader?.match(/^Bearer\s+(.+)$/);
    if (!match) {
      throw new UnauthorizedException('Missing API key');
    }
    const [apiKeyId, apiKeySecret] = match[1].trim().split(':');
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
