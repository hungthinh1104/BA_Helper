import { Module } from '@nestjs/common';
import { DomainPackRegistry } from './application/domain-pack.registry';
import { DomainPackController } from './api/domain-pack.controller';

@Module({
  controllers: [DomainPackController],
  providers: [DomainPackRegistry],
  exports: [DomainPackRegistry],
})
export class DomainPackModule {}
