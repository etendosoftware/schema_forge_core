import {
  Injectable,
  Logger,
  ServiceUnavailableException,
  type CanActivate,
  type ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
// Regular (not `import type`) import — see cached-token-exchange.service.ts for why:
// constructor-injected types must be real imports for emitDecoratorMetadata (ETP-5345).
import { CachedTokenExchangeService } from '../auth/cached-token-exchange.service.ts';
import { InvalidApiKeyError, TokenExchangeUnavailableError } from '../auth/token-exchange.service.ts';

/** What {@link PublicApiKeyGuard} attaches to an authenticated request. */
export interface PublicApiKeyRequest {
  /** The Etendo access token to forward as `Authorization: Bearer`. */
  neoJwt: string;
  /**
   * Drops `neoJwt` from the token cache. Call it when Etendo answers the forwarded call with
   * 401, so the next request re-exchanges the key instead of replaying a refused token.
   */
  evictNeoJwt: () => void;
}

@Injectable()
export class PublicApiKeyGuard implements CanActivate {
  private readonly logger = new Logger(PublicApiKeyGuard.name);

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
    // Split on the FIRST colon only: a client id never contains one, a secret may.
    const credential = match[1].trim();
    const separator = credential.indexOf(':');
    const apiKeyId = separator === -1 ? '' : credential.slice(0, separator);
    const apiKeySecret = separator === -1 ? '' : credential.slice(separator + 1);
    if (!apiKeyId || !apiKeySecret) {
      throw new UnauthorizedException('Malformed API key');
    }
    let jwt: string;
    try {
      jwt = await this.tokenExchange.getJwtForApiKey(apiKeyId, apiKeySecret);
    } catch (error) {
      if (error instanceof InvalidApiKeyError) {
        throw new UnauthorizedException('Invalid API key');
      }
      // Etendo could not be asked (outage, timeout, garbage answer): the key may be fine, so
      // this is not a 401. Never log the credential.
      if (error instanceof TokenExchangeUnavailableError) {
        // Its message is a fixed string; the cause chain adds only names and codes
        // (TimeoutError, ECONNREFUSED), never a cause's own message.
        this.logger.warn(`API key exchange unavailable: ${describeUnavailable(error)}`);
      } else {
        // Not a failure the exchanger classified: a bug, so keep the stack.
        this.logger.error(
          `API key exchange failed unexpectedly: ${error instanceof Error ? error.name : typeof error}`,
          error instanceof Error ? error.stack : undefined
        );
      }
      throw new ServiceUnavailableException('Authentication service unavailable');
    }
    request.neoJwt = jwt;
    // A closure rather than exposing the cache: the controller needs no new dependency and
    // can only evict the one token this request carried.
    request.evictNeoJwt = () => {
      this.tokenExchange.evictJwt(jwt);
    };
    return true;
  }
}

/** "<message> (status N) [cause: TypeError, cause: Error ECONNREFUSED]" — names and codes only. */
function describeUnavailable(error: TokenExchangeUnavailableError): string {
  const parts = [error.message];
  if (typeof error.status === 'number') parts.push(`(status ${error.status})`);
  const causes: string[] = [];
  let cause: unknown = error.cause;
  for (let depth = 0; depth < 3 && cause instanceof Error; depth++) {
    const code = (cause as { code?: unknown }).code;
    causes.push(typeof code === 'string' ? `${cause.name} ${code}` : cause.name);
    cause = cause.cause;
  }
  if (causes.length > 0) parts.push(`[cause: ${causes.join(', cause: ')}]`);
  return parts.join(' ');
}
