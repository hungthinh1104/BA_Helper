import type { ClarificationItem } from '@prisma/client';
import type { ClarificationItemDto } from '@ba-helper/contracts';

export class ClarificationMapper {
  static toDto(entity: ClarificationItem): ClarificationItemDto {
    return {
      id: entity.id,
      impactAnalysisId: entity.impactAnalysisId,
      sourceInsightId: entity.sourceInsightId,
      question: entity.question,
      reason: entity.reason,
      status: entity.status,
      answer: entity.answer,
      createdAt: entity.createdAt.toISOString(),
      updatedAt: entity.updatedAt.toISOString(),
    };
  }

  static toDtoList(entities: ClarificationItem[]): ClarificationItemDto[] {
    return entities.map(this.toDto);
  }
}
