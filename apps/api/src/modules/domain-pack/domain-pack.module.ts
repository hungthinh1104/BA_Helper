import { Module } from '@nestjs/common';
import { DomainPackController } from './domain-pack.controller';
import { DomainPackModule as RuntimeDomainPackModule } from '@ba-helper/backend-runtime';

@Module({
  imports: [RuntimeDomainPackModule],
  controllers: [DomainPackController],
})
export class ApiDomainPackModule {}
