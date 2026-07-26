import { Module } from '@nestjs/common';
import { DomainPackRegistry } from './application/domain-pack.registry';
@Module({
  providers: [DomainPackRegistry],
  exports: [DomainPackRegistry],
})
export class DomainPackModule {}
