import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { RunImpactAnalysisUseCase } from '../../../api/src/modules/impact-analysis/application/run-impact-analysis.usecase';

@Processor('impact-analysis')
export class ImpactAnalysisProcessor extends WorkerHost {
  constructor(private readonly runAnalysis: RunImpactAnalysisUseCase) {
    super();
  }

  async process(job: Job<{ analysisId: string }>): Promise<void> {
    try {
      await this.runAnalysis.execute({
        analysisId: job.data.analysisId,
        expandGraph: true,
      });
    } catch (e: any) {
      console.error(`ImpactAnalysisProcessor failed for job ${job.id}:`, e);
      throw e;
    }
  }
}
