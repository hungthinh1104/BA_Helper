import { RequirementRepository } from '../infrastructure/requirement.repository';
import { AppError } from '../../../shared/app-error';

export class GetRequirementUseCase {
  constructor(private readonly requirementRepo: RequirementRepository) {}

  async execute(params: { requirementId: string }) {
    const requirement = await this.requirementRepo.findRequirementById(params.requirementId);
    if (!requirement) {
      throw new AppError('REQUIREMENT_NOT_FOUND', 'Requirement not found.');
    }

    return requirement;
  }
}
