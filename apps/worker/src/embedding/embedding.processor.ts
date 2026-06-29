import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { EmbedSnapshotArtifactsUseCase } from '@ba-helper/application';

@Processor('embedding')
export class EmbeddingProcessor extends WorkerHost {
  private readonly logger = new Logger(EmbeddingProcessor.name);

  constructor(
    private readonly embedSnapshotArtifactsUseCase: EmbedSnapshotArtifactsUseCase,
  ) {
    super();
  }

  async process(job: Job<{ snapshotId: string }>): Promise<void> {
    switch (job.name) {
      case 'embed_snapshot':
        this.logger.log(`Processing embed_snapshot for ${job.data.snapshotId}`);
        try {
          await this.embedSnapshotArtifactsUseCase.execute({
            snapshotId: job.data.snapshotId,
          });
          this.logger.log(`Successfully embedded snapshot ${job.data.snapshotId}`);
        } catch (e: unknown) {
          this.logger.error(`Error embedding snapshot ${job.data.snapshotId}`, e);
          throw e;
        }
        break;
      default:
        throw new Error(`Unknown job name: ${job.name}`);
    }
  }
}
