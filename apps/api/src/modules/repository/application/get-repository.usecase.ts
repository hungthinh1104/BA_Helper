import { RepositoryRepository } from '../infrastructure/repository.repository';
import { AppError } from '@ba-helper/shared';

export class GetRepositoryUseCase {
  constructor(private readonly repositoryRepo: RepositoryRepository) {}

  async execute(params: { repositoryId: string }) {
    const repository = await this.repositoryRepo.findById(params.repositoryId);
    if (!repository) {
      throw new AppError('REPOSITORY_NOT_FOUND', 'Repository not found.');
    }

    return repository;
  }
}
