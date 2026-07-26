import { Injectable } from '@nestjs/common';
import { MultiRepoAnalysisRunRepository } from "@ba-helper/backend-runtime";

@Injectable()
export class ListMultiRepoAnalysisRunsUseCase {
  constructor(private readonly runs: MultiRepoAnalysisRunRepository) {}

  async execute(projectId: string) {
    return this.runs.listByProject(projectId);
  }
}
