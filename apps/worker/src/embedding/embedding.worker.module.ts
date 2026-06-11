import { Module } from '@nestjs/common';
import { EmbeddingProcessor } from './embedding.processor';
import { EmbeddingModule } from '../../../api/src/modules/embedding/embedding.module';

@Module({
  imports: [EmbeddingModule],
  providers: [EmbeddingProcessor],
})
export class EmbeddingWorkerModule {}
