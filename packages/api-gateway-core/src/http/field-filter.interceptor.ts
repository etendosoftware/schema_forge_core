import { Injectable, type CallHandler, type ExecutionContext, type NestInterceptor } from '@nestjs/common';
import { map, type Observable } from 'rxjs';
import { filterOutboundRecord } from '../filter/field-filter.ts';
import type { PublicApiSchema } from '../types.ts';

export const PUBLIC_API_SCHEMA = 'PUBLIC_API_SCHEMA';

export function PublicApiEntityName(entityName: string) {
  return (target: object, _key: string, descriptor: PropertyDescriptor) => {
    (descriptor.value as { __publicApiEntityName?: string }).__publicApiEntityName = entityName;
    return descriptor;
  };
}

@Injectable()
export class FieldFilterInterceptor implements NestInterceptor {
  constructor(private readonly schema: PublicApiSchema) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const handler = context.getHandler() as unknown as { __publicApiEntityName?: string };
    const entityName = handler.__publicApiEntityName;
    const entity = entityName ? this.schema.entities[entityName] : undefined;
    return next.handle().pipe(
      map((body) => {
        if (!entity) return body;
        if (Array.isArray(body)) {
          return body.map((record) => filterOutboundRecord(entity, record));
        }
        return filterOutboundRecord(entity, body as Record<string, unknown>);
      })
    );
  }
}
