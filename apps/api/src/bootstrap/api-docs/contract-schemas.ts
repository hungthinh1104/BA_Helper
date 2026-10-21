import * as contracts from '@ba-helper/contracts';
import { extendZodWithOpenApi, OpenAPIRegistry, OpenApiGeneratorV3 } from '@asteasolutions/zod-to-openapi';
import type { ReferenceObject, SchemaObject } from '@nestjs/swagger/dist/interfaces/open-api-spec.interface';
import { z, type ZodTypeAny } from 'zod';

extendZodWithOpenApi(z);

// The v3-compatible generator does not support ZodCatch. Catch affects parsing,
// not the valid actorType output enum; retain every other field from the contract.
const eventList = contracts.eventLogListResponseSchema.extend({
  items: z.array(contracts.eventLogDtoSchema.extend({
    actorType: contracts.eventLogDtoSchema.shape.actorType.removeCatch(),
  })),
});

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
      this.registry.register(name, schema === contracts.eventLogListResponseSchema ? eventList : schema);
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
