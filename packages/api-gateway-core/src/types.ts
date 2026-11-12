export type FieldDirection = 'in' | 'out' | 'inout';

export interface PublicApiField {
  publicApi: true;
  direction: FieldDirection;
  internalPath: string;
}

export interface PublicApiEntity {
  publicApi: true;
  // The artifact/spec directory name (e.g. "contacts"), not always the same as
  // the entity name (e.g. "businessPartner") — NeoServlet's real URL pattern is
  // /sws/neo/{specName}/{entityName}.
  specName: string;
  operations: string[];
  fields: Record<string, PublicApiField>;
}

export interface PublicApiSchema {
  apiVersion: string;
  entities: Record<string, PublicApiEntity>;
}
