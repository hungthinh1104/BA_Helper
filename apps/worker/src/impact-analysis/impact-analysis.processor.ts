import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job, UnrecoverableError } from 'bullmq';
import { RunImpactAnalysisUseCase } from '@ba-helper/application';
import { AiOutputError } from '../../../api/src/modules/ai/domain/ai.errors';

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

      if (e instanceof AiOutputError) {
        if (
          e.code === 'AI_JSON_PARSE_FAILED' ||
          e.code === 'AI_OUTPUT_SCHEMA_INVALID' ||
          e.code === 'AI_OUTPUT_SCHEMA_VALIDATION_FAILED' ||
          e.code === 'AI_OUTPUT_TRUNCATED'
        ) {
          if (job.attemptsMade >= 1) {
            throw new UnrecoverableError(`Unrecoverable Schema Error: ${e.message}`);
          }
        }
      } else {
        const msg = (e.message || '').toLowerCase();
        if (msg.includes('auth') || msg.includes('key') || msg.includes('quota') || msg.includes('not found') || msg.includes('forbidden')) {
          throw new UnrecoverableError(`Unrecoverable Provider Error: ${e.message}`);
        }
      }

      throw e;
    }
  }
}
