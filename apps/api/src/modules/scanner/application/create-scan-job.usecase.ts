import { ScanJobRepository } from '../infrastructure/scan-job.repository';
import { RepositoryRepository } from '../../repository/infrastructure/repository.repository';
import { ScanJobPolicy } from '../domain/scan-job.policy';
import { AppError } from '../../../shared/app-error';
import { EventLogService } from '../../event-log/application/event-log.service';

export class CreateScanJobUseCase {
  constructor(
    private readonly scanJobRepository: ScanJobRepository,
    private readonly repositoryRepository: RepositoryRepository,
    private readonly eventLog: EventLogService,
  ) {}

  async execute(params: {
    repositoryId: string;
    requestKey: string;
    requestedRef?: string;
  }) {
    const repository = await this.repositoryRepository.findById(
      params.repositoryId,
    );

    if (!repository) {
      throw new AppError('REPOSITORY_NOT_FOUND', 'Repository not found.');
    }

    ScanJobPolicy.validateRef(params.requestedRef);

    const existing = await this.scanJobRepository.findByRepositoryAndRequestKey({
      repositoryId: params.repositoryId,
      requestKey: params.requestKey,
    });

    if (existing) {
      if (existing.requestedRef !== (params.requestedRef ?? null)) {
        throw new AppError(
          'REQUEST_KEY_MISMATCH',
          'Request key reuse with different payload.',
        );
      }
      return existing;
    }

    const job = await this.scanJobRepository.createQueued({
      repositoryId: params.repositoryId,
      requestKey: params.requestKey,
      requestedRef: params.requestedRef,
    });

    await this.eventLog.recordEvent({
      eventType: 'SCAN_JOB_QUEUED',
      idempotencyKey: `scan:${job.id}:queued`,
      payload: {
        repositoryId: job.repositoryId,
        scanJobId: job.id,
        requestKey: job.requestKey,
      },
    });

    return job;
  }
}
