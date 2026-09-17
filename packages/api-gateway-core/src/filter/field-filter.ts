import type { PublicApiEntity } from '../types.ts';

export class UnknownFieldError extends Error {
  constructor(public readonly fieldName: string) {
    super(`Field "${fieldName}" is not exposed by the public API`);
    this.name = 'UnknownFieldError';
  }
}

export function filterInboundParams(
  entity: PublicApiEntity,
  params: Record<string, unknown>
): Record<string, unknown> {
  for (const key of Object.keys(params)) {
    if (!entity.fields[key]) {
      throw new UnknownFieldError(key);
    }
  }
  return { ...params };
}

export function filterOutboundRecord(
  entity: PublicApiEntity,
  record: Record<string, unknown>
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [publicName, field] of Object.entries(entity.fields)) {
    if (field.internalPath in record) {
      result[publicName] = record[field.internalPath];
    }
  }
  return result;
}
