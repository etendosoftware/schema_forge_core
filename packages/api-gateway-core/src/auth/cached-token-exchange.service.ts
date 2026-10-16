import { createHmac, randomBytes } from 'node:crypto';
// Regular (not `import type`) import: this class is constructor-injected by
// NestJS elsewhere (gateway/src/app.module.ts), which needs `emitDecoratorMetadata`
// to reflect the real class reference for design:paramtypes — a type-only import
// erases that reference, silently breaking DI resolution at runtime (ETP-5345).
import { TokenExchangeService } from './token-exchange.service.ts';

/**
 * Seconds before Etendo's expiry at which a cached token stops being handed out, so a token
 * is never forwarded with only a moment of life left. A token whose whole lifetime is not
 * longer than this is used for the request that obtained it and never cached.
 */
export const TOKEN_CACHE_SAFETY_MARGIN_SECONDS = 30;

/** Upper bound on cached credentials; the least recently used entry goes first. */
export const TOKEN_CACHE_MAX_ENTRIES = 1000;

export interface CachedTokenExchangeOptions {
  safetyMarginSeconds?: number;
  maxEntries?: number;
  /** Clock in epoch milliseconds; injectable for tests. */
  now?: () => number;
}

interface CacheEntry {
  jwt: string;
  /** Epoch ms after which the entry is no longer served (Etendo's expiry minus the margin). */
  usableUntil: number;
}

export class CachedTokenExchangeService {
  // Keyed by an HMAC of the full credential, never by the client id alone: a lookup with a
  // wrong secret produces a different key and always reaches Etendo. The HMAC key is random
  // per instance, so a key seen in a heap dump cannot be tested against guessed secrets
  // offline or matched across processes.
  private readonly cache = new Map<string, CacheEntry>();
  private readonly hmacKey = randomBytes(32);
  private readonly safetyMarginMs: number;
  private readonly maxEntries: number;
  private readonly now: () => number;

  constructor(
    private readonly exchanger: TokenExchangeService,
    options: CachedTokenExchangeOptions = {}
  ) {
    this.safetyMarginMs = (options.safetyMarginSeconds ?? TOKEN_CACHE_SAFETY_MARGIN_SECONDS) * 1000;
    this.maxEntries = Math.max(1, options.maxEntries ?? TOKEN_CACHE_MAX_ENTRIES);
    this.now = options.now ?? Date.now;
  }

  async getJwtForApiKey(apiKeyId: string, apiKeySecret: string): Promise<string> {
    const key = this.cacheKey(apiKeyId, apiKeySecret);
    const cached = this.cache.get(key);
    if (cached) {
      this.cache.delete(key);
      if (cached.usableUntil > this.now()) {
        this.cache.set(key, cached); // re-insert: Map order doubles as LRU order
        return cached.jwt;
      }
    }
    // A failed exchange throws before anything is stored, so failures are never cached.
    const result = await this.exchanger.exchangeApiKeyForJwt(apiKeyId, apiKeySecret);
    const usableUntil = result.expiresAt * 1000 - this.safetyMarginMs;
    if (usableUntil > this.now()) {
      this.store(key, { jwt: result.jwt, usableUntil });
    }
    return result.jwt;
  }

  /**
   * Drop every cached entry holding this token — called when Etendo refuses a forwarded call
   * with 401 (the key was rotated, revoked, deactivated or deleted). Matching on the token, not
   * the credential, means a late 401 for an old token never evicts a fresh one.
   *
   * @returns whether anything was evicted
   */
  evictJwt(jwt: string): boolean {
    let evicted = false;
    for (const [key, entry] of this.cache) {
      if (entry.jwt === jwt) {
        this.cache.delete(key);
        evicted = true;
      }
    }
    return evicted;
  }

  /** Number of cached credentials (expired ones included until the next purge). */
  get size(): number {
    return this.cache.size;
  }

  private store(key: string, entry: CacheEntry): void {
    if (this.cache.size >= this.maxEntries) {
      this.purgeExpired();
    }
    for (const oldest of this.cache.keys()) {
      if (this.cache.size < this.maxEntries) break;
      this.cache.delete(oldest);
    }
    this.cache.set(key, entry);
  }

  private purgeExpired(): void {
    const now = this.now();
    for (const [key, entry] of this.cache) {
      if (entry.usableUntil <= now) this.cache.delete(key);
    }
  }

  private cacheKey(apiKeyId: string, apiKeySecret: string): string {
    // Length-prefixing the id makes the encoding unambiguous: ("a:b", "c") and ("a", "b:c")
    // can never collide.
    return createHmac('sha256', this.hmacKey)
      .update(`${apiKeyId.length}:${apiKeyId}:${apiKeySecret}`)
      .digest('base64url');
  }
}
