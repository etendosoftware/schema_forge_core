export type FieldDirection = 'in' | 'out' | 'inout';
export type FieldMappingType = 'passthrough' | 'custom';
export interface PublicApiField {
    publicApi: true;
    direction: FieldDirection;
    internalPath: string;
    type: FieldMappingType;
    handlerId: string | null;
}
export interface PublicApiEntity {
    publicApi: true;
    operations: string[];
    fields: Record<string, PublicApiField>;
}
export interface PublicApiSchema {
    apiVersion: string;
    entities: Record<string, PublicApiEntity>;
}
