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
        await this.embedSnapshotArtifactsUseCase.execute({
          snapshotId: job.data.snapshotId,
        });
        break;
      default:
        throw new Error(`Unknown job name: ${job.name}`);
    }
  }
}
