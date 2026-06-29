import { Module } from '@nestjs/common';
import { PrismaService } from '../index';

@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
