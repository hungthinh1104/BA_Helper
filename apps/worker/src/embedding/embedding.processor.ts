import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { EmbedSnapshotArtifactsUseCase } from '@ba-helper/application';
import { processWithClassification } from '../shared/classified-processing';

@Processor('embedding')
export class EmbeddingProcessor extends WorkerHost {
  private readonly logger = new Logger(EmbeddingProcessor.name);

  constructor(
    private readonly embedSnapshotArtifactsUseCase: EmbedSnapshotArtifactsUseCase,
  ) {
    super();
  }

  async process(job: Job<{ snapshotId: string }>): Promise<void> {
    if (job.name !== 'embed_snapshot') {
      // An unknown job name is a config/programming error, not a transient fault.
      throw new UnknownEmbeddingJobError(job.name);
    }
    await processWithClassification({
      logger: this.logger,
      job,
      event: 'EMBEDDING_JOB',
      context: { snapshotId: job.data.snapshotId },
      run: () =>
        this.embedSnapshotArtifactsUseCase.execute({
          snapshotId: job.data.snapshotId,
        }),
    });
  }
}

class UnknownEmbeddingJobError extends Error {
  readonly code = 'UNKNOWN_EMBEDDING_JOB';
  constructor(jobName: string) {
    super(`Unknown embedding job name: ${jobName}`);
    this.name = 'UnknownEmbeddingJobError';
  }
}
