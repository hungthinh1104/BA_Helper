import { Module } from '@nestjs/common';
import { EmbeddingProcessor } from './embedding.processor';
import { EmbeddingModule } from '@ba-helper/backend-runtime/embedding';

@Module({
  imports: [EmbeddingModule],
  providers: [EmbeddingProcessor],
})
export class EmbeddingWorkerModule {}
