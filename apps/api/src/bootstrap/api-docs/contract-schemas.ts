import { extendZodWithOpenApi, OpenAPIRegistry, OpenApiGeneratorV3 } from '@asteasolutions/zod-to-openapi';
import type { ReferenceObject, SchemaObject } from '@nestjs/swagger/dist/interfaces/open-api-spec.interface';
import { z, type ZodTypeAny } from 'zod';
import type * as Contracts from '@ba-helper/contracts';

extendZodWithOpenApi(z);

// Zod 4 extensions must be installed before contract schemas are constructed.
// Keep the contracts package independent from the OpenAPI adapter while loading
// it after the adapter has patched the shared Zod prototype.
const contracts = require('@ba-helper/contracts') as typeof Contracts;

export class ContractSchemas {
  private readonly registry = new OpenAPIRegistry();
  private readonly registered = new Map<ZodTypeAny, string>();
  private readonly names = new Map<ZodTypeAny, string>();

  constructor() {
    for (const [name, schema] of Object.entries(contracts)) {
      if (schema instanceof z.ZodType) this.names.set(schema, name.replace(/Schema$/, ''));
    }
  }

  reference(schema: ZodTypeAny, fallback: string): ReferenceObject {
    let name = this.registered.get(schema);
    if (!name) {
      name = this.names.get(schema) ?? fallback;
      this.registry.register(name, ensureOpenApiSchema(schema));
      this.registered.set(schema, name);
    }
    return { $ref: `#/components/schemas/${name}` };
  }

  build(): Record<string, SchemaObject | ReferenceObject> {
    // The V3 generator emits OpenAPI 3.0; its shared 3.0/3.1 TS definitions
    // permit array-valued types that Nest's 3.0 interface does not. Validate
    // the generated wire document with a full OpenAPI validator in API E2E.
    return (new OpenApiGeneratorV3(this.registry.definitions).generateComponents().components?.schemas ?? {}) as Record<string, SchemaObject | ReferenceObject>;
  }
}

function ensureOpenApiSchema(schema: ZodTypeAny): ZodTypeAny {
  if (typeof (schema as ZodTypeAny & { openapi?: unknown }).openapi === 'function') return schema;
  const openapi = (z.ZodType.prototype as unknown as { openapi?: (...args: unknown[]) => unknown }).openapi;
  if (!openapi) throw new Error('OpenAPI Zod extension was not installed.');
  Object.defineProperty(schema, 'openapi', { configurable: true, value: openapi.bind(schema) });
  return schema;
}
