import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { EmbedSnapshotArtifactsUseCase } from '../../../api/src/modules/embedding/application/embed-snapshot-artifacts.usecase';

@Processor('embedding')
export class EmbeddingProcessor extends WorkerHost {
  constructor(
    private readonly embedSnapshotArtifactsUseCase: EmbedSnapshotArtifactsUseCase,
  ) {
    super();
  }

  async process(job: Job<{ snapshotId: string }>): Promise<void> {
    switch (job.name) {
      case 'embed_snapshot':
        console.log(`[EmbeddingProcessor] Processing embed_snapshot for ${job.data.snapshotId}`);
        try {
          await this.embedSnapshotArtifactsUseCase.execute({
            snapshotId: job.data.snapshotId,
          });
          console.log(`[EmbeddingProcessor] Successfully embedded snapshot ${job.data.snapshotId}`);
        } catch (e: any) {
          console.error(`[EmbeddingProcessor] Error embedding snapshot ${job.data.snapshotId}:`, e);
          throw e;
        }
        break;
      default:
        throw new Error(`Unknown job name: ${job.name}`);
    }
  }
}
