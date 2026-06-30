import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job, UnrecoverableError } from 'bullmq';
import { RunImpactAnalysisUseCase } from '@ba-helper/application';
import { classifyWorkerError } from './job-error-classifier';

@Processor('impact-analysis')
export class ImpactAnalysisProcessor extends WorkerHost {
  private readonly logger = new Logger(ImpactAnalysisProcessor.name);

  constructor(private readonly runAnalysis: RunImpactAnalysisUseCase) {
    super();
  }

  async process(job: Job<{ analysisId: string }>): Promise<void> {
    try {
      await this.runAnalysis.execute({
        analysisId: job.data.analysisId,
        expandGraph: true,
      });
    } catch (e: unknown) {
      const recoverability = classifyWorkerError(e);
      const errorCode = (e instanceof Error && 'code' in e) ? (e as any).code : undefined;
      const errorName = e instanceof Error ? e.name : 'UnknownError';

      this.logger.error(
        JSON.stringify({
          event: 'IMPACT_ANALYSIS_JOB_FAILED',
          jobId: job.id,
          analysisId: job.data.analysisId,
          attemptsMade: job.attemptsMade,
          errorCode,
          errorName,
          recoverability,
        }),
      );

      if (recoverability === 'UNRECOVERABLE') {
        throw new UnrecoverableError(
          `[${errorCode ?? 'UNKNOWN'}] ${errorName}`,
        );
      }

      throw e;
    }
  }
}
