import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

export class QueueService {
  constructor(
    @InjectQueue('impact-analysis')
    private readonly impactQueue: Queue,
    @InjectQueue('embedding')
    private readonly embeddingQueue: Queue,
  ) {}

  async enqueueImpactAnalysis(analysisId: string) {
    await this.impactQueue.add(
      'run',
      { analysisId },
      { jobId: `impact:${analysisId}` },
    );
  }

  async enqueueSnapshotEmbedding(snapshotId: string) {
    await this.embeddingQueue.add(
      'embed_snapshot',
      { snapshotId },
      { jobId: `embed:${snapshotId}` },
    );
  }
}
