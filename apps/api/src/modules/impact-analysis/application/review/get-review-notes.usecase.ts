import { Injectable } from '@nestjs/common';
import { AppError } from '@ba-helper/shared';
import { ReviewNoteRepository, ImpactAnalysisRepository } from "@ba-helper/backend-runtime";

@Injectable()
export class GetReviewNotesUseCase {
  constructor(
    private readonly reviewNoteRepo: ReviewNoteRepository,
    private readonly impactAnalysisRepo: ImpactAnalysisRepository,
  ) {}

  async execute(analysisId: string) {
    const analysis = await this.impactAnalysisRepo.findById(analysisId);
    if (!analysis) {
      throw new AppError('IMPACT_ANALYSIS_NOT_FOUND', 'Analysis not found');
    }

    const notes = await this.reviewNoteRepo.findByAnalysisId(analysisId);
    return {
      items: notes.map((note) => ({
        id: note.id,
        impactAnalysisId: note.impactAnalysisId,
        insightId: note.insightId,
        traceabilityLinkId: note.traceabilityLinkId,
        body: note.body,
        createdAt: note.createdAt.toISOString(),
        updatedAt: note.updatedAt.toISOString(),
      })),
    };
  }
}
