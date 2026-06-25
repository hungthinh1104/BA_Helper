import { CreateRepositoryUseCase } from './create-repository.usecase';
import { RepositoryRepository } from '../infrastructure/repository.repository';
import { ProjectRepository } from '../../project/infrastructure/project.repository';
import { EventLogService } from '../../event-log/application/event-log.service';
import { AppError } from '@ba-helper/shared';
import { RepositoryPolicy } from '../domain/repository.policy';

jest.mock('../domain/repository.policy');

describe('CreateRepositoryUseCase', () => {
  let useCase: CreateRepositoryUseCase;
  let repository: jest.Mocked<RepositoryRepository>;
  let projectRepository: jest.Mocked<ProjectRepository>;
  let eventLog: jest.Mocked<EventLogService>;

  beforeEach(() => {
    repository = {
      findByProjectAndUrl: jest.fn(),
      createRepository: jest.fn(),
    } as unknown as jest.Mocked<RepositoryRepository>;

    projectRepository = {
      findById: jest.fn(),
    } as unknown as jest.Mocked<ProjectRepository>;

    eventLog = {
      recordEvent: jest.fn(),
    } as unknown as jest.Mocked<EventLogService>;

    useCase = new CreateRepositoryUseCase(
      repository,
      projectRepository,
      eventLog,
    );

    (RepositoryPolicy.normalizeUrl as jest.Mock).mockReturnValue({
      canonicalUrl: 'https://github.com/org/repo',
    });
  });

  it('should throw an error if project is not found', async () => {
    projectRepository.findById.mockResolvedValue(null);

    await expect(
      useCase.execute({ projectId: 'p1', url: 'invalid' }),
    ).rejects.toThrow(AppError);
  });

  it('should return existing repository if one matches canonical URL', async () => {
    projectRepository.findById.mockResolvedValue({ id: 'p1' } as any);
    const existing = { id: 'repo1', canonicalUrl: 'https://github.com/org/repo' };
    repository.findByProjectAndUrl.mockResolvedValue(existing as any);

    const result = await useCase.execute({
      projectId: 'p1',
      url: 'https://github.com/org/repo',
    });

    expect(result).toEqual(existing);
    expect(repository.createRepository).not.toHaveBeenCalled();
    expect(eventLog.recordEvent).not.toHaveBeenCalled();
  });

  it('should create a new repository and record an event', async () => {
    projectRepository.findById.mockResolvedValue({ id: 'p1' } as any);
    repository.findByProjectAndUrl.mockResolvedValue(null);
    const created = { id: 'repo2', projectId: 'p1' };
    repository.createRepository.mockResolvedValue(created as any);

    const result = await useCase.execute({
      projectId: 'p1',
      url: 'https://github.com/org/repo',
    });

    expect(result).toEqual(created);
    expect(repository.createRepository).toHaveBeenCalledWith({
      projectId: 'p1',
      canonicalUrl: 'https://github.com/org/repo',
    });
    expect(eventLog.recordEvent).toHaveBeenCalledWith({
      eventType: 'REPOSITORY_CREATED',
      idempotencyKey: 'repository:repo2:created',
      payload: { projectId: 'p1', repositoryId: 'repo2' },
    });
  });
});
