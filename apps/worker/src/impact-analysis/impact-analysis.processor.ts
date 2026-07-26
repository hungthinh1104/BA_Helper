import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { RunImpactAnalysisUseCase } from '@ba-helper/application';
import { processWithClassification } from '../shared/classified-processing';

@Processor('impact-analysis')
export class ImpactAnalysisProcessor extends WorkerHost {
  private readonly logger = new Logger(ImpactAnalysisProcessor.name);

  constructor(private readonly runAnalysis: RunImpactAnalysisUseCase) {
    super();
  }

  async process(job: Job<{ analysisId: string }>): Promise<void> {
    await processWithClassification({
      logger: this.logger,
      job,
      event: 'IMPACT_ANALYSIS_JOB',
      context: { analysisId: job.data.analysisId },
      run: () =>
        this.runAnalysis.execute({
          analysisId: job.data.analysisId,
          expandGraph: true,
        }),
    });
  }
}
