import { Injectable } from '@nestjs/common';
import { MultiRepoAnalysisRunRepository } from '../infrastructure/multi-repo-analysis-run.repository';

@Injectable()
export class ListMultiRepoAnalysisRunsUseCase {
  constructor(private readonly runs: MultiRepoAnalysisRunRepository) {}

  async execute(projectId: string) {
    return this.runs.listByProject(projectId);
  }
}
