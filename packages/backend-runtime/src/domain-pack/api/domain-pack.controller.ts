import { Controller, Get } from '@nestjs/common';
import { domainPackRegistryResponseSchema } from '@ba-helper/contracts';
import { DomainPackRegistry } from '../application/domain-pack.registry';

@Controller('/api/v1/domain-packs')
export class DomainPackController {
  constructor(private readonly registry: DomainPackRegistry) {}

  @Get()
  listDomainPacks() {
    return domainPackRegistryResponseSchema.parse({
      items: this.registry.listProfiles(),
    });
  }
}
