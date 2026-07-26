import { CreateScanJobUseCase } from './create-scan-job.usecase';
import type { ScanJobRepository, EventLogService } from '@ba-helper/backend-runtime';
import { AppError } from '@ba-helper/shared';
import { RepositoryRepository, QueueService } from "@ba-helper/backend-runtime";
import { ScanJobPolicy } from "@ba-helper/application/scanner";


describe('CreateScanJobUseCase', () => {
  let useCase: CreateScanJobUseCase;
  let scanJobRepository: jest.Mocked<ScanJobRepository>;
  let repositoryRepository: jest.Mocked<RepositoryRepository>;
  let eventLog: jest.Mocked<EventLogService>;
  let queueService: jest.Mocked<QueueService>;

  beforeEach(() => {
    scanJobRepository = {
      findByRepositoryAndRequestKey: jest.fn(),
      createQueued: jest.fn(),
    } as unknown as jest.Mocked<ScanJobRepository>;

    repositoryRepository = {
      findById: jest.fn(),
    } as unknown as jest.Mocked<RepositoryRepository>;

    eventLog = {
      recordEvent: jest.fn(),
    } as unknown as jest.Mocked<EventLogService>;

    queueService = {
      enqueueScanJob: jest.fn(),
    } as unknown as jest.Mocked<QueueService>;

    useCase = new CreateScanJobUseCase(
      scanJobRepository,
      repositoryRepository,
      eventLog,
      queueService,
    );

    jest.spyOn(ScanJobPolicy, 'validateRef').mockImplementation(() => {});
  });

  it('should throw if repository is not found', async () => {
    repositoryRepository.findById.mockResolvedValue(null);

    await expect(
      useCase.execute({ repositoryId: 'r1', requestKey: 'k1' }),
    ).rejects.toThrow(AppError);
  });

  it('should return existing job if requestedRef matches', async () => {
    repositoryRepository.findById.mockResolvedValue({ id: 'r1' } as any);
    const existing = { id: 'j1', requestedRef: 'main' };
    scanJobRepository.findByRepositoryAndRequestKey.mockResolvedValue(existing as any);

    const result = await useCase.execute({
      repositoryId: 'r1',
      requestKey: 'k1',
      requestedRef: 'main',
    });

    expect(result).toEqual(existing);
    expect(scanJobRepository.createQueued).not.toHaveBeenCalled();
    expect(queueService.enqueueScanJob).not.toHaveBeenCalled();
  });

  it('should throw if existing job has different requestedRef', async () => {
    repositoryRepository.findById.mockResolvedValue({ id: 'r1' } as any);
    const existing = { id: 'j1', requestedRef: 'main' };
    scanJobRepository.findByRepositoryAndRequestKey.mockResolvedValue(existing as any);

    await expect(
      useCase.execute({
        repositoryId: 'r1',
        requestKey: 'k1',
        requestedRef: 'dev',
      }),
    ).rejects.toThrow(AppError);
  });

  it('should create a new queued job, log event, and enqueue', async () => {
    repositoryRepository.findById.mockResolvedValue({ id: 'r1' } as any);
    scanJobRepository.findByRepositoryAndRequestKey.mockResolvedValue(null);
    const created = { id: 'j2', repositoryId: 'r1', requestKey: 'k1', requestedRef: 'main' };
    scanJobRepository.createQueued.mockResolvedValue(created as any);

    const result = await useCase.execute({
      repositoryId: 'r1',
      requestKey: 'k1',
      requestedRef: 'main',
    });

    expect(result).toEqual(created);
    expect(scanJobRepository.createQueued).toHaveBeenCalledWith({
      repositoryId: 'r1',
      requestKey: 'k1',
      requestedRef: 'main',
    });
    expect(eventLog.recordEvent).toHaveBeenCalledWith({
      eventType: 'SCAN_JOB_QUEUED',
      idempotencyKey: 'scan:j2:queued',
      payload: { repositoryId: 'r1', scanJobId: 'j2', requestKey: 'k1' },
    });
    expect(queueService.enqueueScanJob).toHaveBeenCalledWith('j2');
  });
});
