import { Injectable } from '@nestjs/common';
import { AppError } from '@ba-helper/shared';
import { LineageTimelineEvent, LineageTimelineResponse } from '@ba-helper/contracts';
import { PrismaService } from "@ba-helper/backend-runtime";

const EVENT_ORDER: Record<LineageTimelineEvent['type'], number> = {
  REQUIREMENT_CREATED: 1,
  REQUIREMENT_REVISED: 1,
  ANALYSIS_CREATED: 2,
  DERIVED_ANALYSIS_CREATED: 2,
  ANALYSIS_COMPLETED: 3,
  IMPACT_DIFF_AVAILABLE: 4,
  REVIEW_DECISION: 5,
  CLARIFICATION_REQUESTED: 6,
  CLARIFICATION_ANSWERED: 7,
};

@Injectable()
export class GetImpactAnalysisLineageUseCase {
  constructor(private readonly prisma: PrismaService) {}

  async execute(currentAnalysisId: string): Promise<LineageTimelineResponse> {
    const chain = [];
    const visited = new Set<string>();

    let current = await this.prisma.impactAnalysis.findUnique({
      where: { id: currentAnalysisId },
    });

    if (!current) {
      throw new AppError('ANALYSIS_NOT_FOUND', 'Analysis not found');
    }

    chain.unshift(current);
    visited.add(current.id);

    let currNode = current;

    while (currNode.derivedFromAnalysisId) {
      if (visited.has(currNode.derivedFromAnalysisId)) {
        throw new AppError('LINEAGE_CYCLE_DETECTED', 'Circular reference detected in analysis lineage');
      }
      visited.add(currNode.derivedFromAnalysisId);

      const parentNode = await this.prisma.impactAnalysis.findUnique({
        where: { id: currNode.derivedFromAnalysisId },
      });

      if (!parentNode) {
        break; // Should not happen with referential integrity, but safe guard
      }

      chain.unshift(parentNode);
      currNode = parentNode;
    }

    const analysisIds = chain.map((a) => a.id);
    const revisionIds = chain.map((a) => a.requirementRevisionId);

    const revisions = await this.prisma.requirementRevision.findMany({
      where: { id: { in: revisionIds } },
    });

    const decisions = await this.prisma.analysisReviewDecision.findMany({
      where: { analysisId: { in: analysisIds } },
      include: { reviewedByUser: true },
      orderBy: { createdAt: 'asc' },
    });

    const decisionIds = decisions.map((d) => d.id);

    const clarifications = await this.prisma.reviewClarificationRequest.findMany({
      where: { reviewDecisionId: { in: decisionIds } },
      include: { createdByUser: true, answeredByUser: true },
      orderBy: { createdAt: 'asc' },
    });

    const events: LineageTimelineEvent[] = [];

    for (let i = 0; i < chain.length; i++) {
      const ana = chain[i];
      const rev = revisions.find((r) => r.id === ana.requirementRevisionId);

      if (rev) {
        events.push({
          id: `req-${rev.id}-${ana.id}`,
          type: i === 0 ? 'REQUIREMENT_CREATED' : 'REQUIREMENT_REVISED',
          title: i === 0 ? 'Original Requirement' : 'Requirement Revised',
          createdAt: rev.createdAt.toISOString(),
          requirementRevisionId: rev.id,
          analysisId: ana.id,
          metadata: { title: rev.title },
        });
      }

      events.push({
        id: `ana-create-${ana.id}`,
        type: i === 0 ? 'ANALYSIS_CREATED' : 'DERIVED_ANALYSIS_CREATED',
        title: i === 0 ? 'Baseline Analysis Started' : 'Derived Analysis Started',
        createdAt: ana.createdAt.toISOString(),
        analysisId: ana.id,
        relatedAnalysisId: ana.derivedFromAnalysisId ?? undefined,
      });

      if (ana.status === 'COMPLETED' || ana.status === 'WAITING_FOR_REVIEW' || ana.status === 'FAILED') {
        events.push({
          id: `ana-comp-${ana.id}`,
          type: 'ANALYSIS_COMPLETED',
          title: ana.status === 'FAILED' ? 'Analysis Failed' : 'Analysis Completed',
          createdAt: ana.updatedAt.toISOString(), // Approximate completion time
          analysisId: ana.id,
          status: ana.status,
        });
      }

      if (i > 0 && (ana.status === 'COMPLETED' || ana.status === 'WAITING_FOR_REVIEW')) {
        events.push({
          id: `diff-${ana.id}`,
          type: 'IMPACT_DIFF_AVAILABLE',
          title: 'Impact Diff Computable',
          createdAt: ana.updatedAt.toISOString(),
          analysisId: ana.id,
          relatedAnalysisId: ana.derivedFromAnalysisId ?? undefined,
        });
      }

      const anaDecisions = decisions.filter((d) => d.analysisId === ana.id);
      for (const dec of anaDecisions) {
        events.push({
          id: `dec-${dec.id}`,
          type: 'REVIEW_DECISION',
          title: `Review Decision: ${dec.decision}`,
          createdAt: dec.createdAt.toISOString(),
          analysisId: ana.id,
          reviewDecisionId: dec.id,
          actor: dec.reviewedByUser?.name || dec.reviewedByUser?.email || dec.reviewedByUserId,
          status: dec.decision,
          metadata: { note: dec.note },
        });

        const clars = clarifications.filter((c) => c.reviewDecisionId === dec.id);
        for (const clar of clars) {
          events.push({
            id: `clar-req-${clar.id}`,
            type: 'CLARIFICATION_REQUESTED',
            title: 'Clarification Requested',
            createdAt: clar.createdAt.toISOString(),
            analysisId: ana.id,
            reviewDecisionId: dec.id,
            clarificationRequestId: clar.id,
            actor: clar.createdByUser?.name || clar.createdByUser?.email || clar.createdByUserId,
            metadata: { question: clar.question },
          });

          if (clar.status === 'ANSWERED' && clar.answeredAt) {
            events.push({
              id: `clar-ans-${clar.id}`,
              type: 'CLARIFICATION_ANSWERED',
              title: 'Clarification Answered',
              createdAt: clar.answeredAt.toISOString(),
              analysisId: ana.id,
              reviewDecisionId: dec.id,
              clarificationRequestId: clar.id,
              actor: clar.answeredByUser?.name || clar.answeredByUser?.email || clar.answeredByUserId || undefined,
              metadata: { answer: clar.answer },
            });
          }
        }
      }
    }

    // Sort by createdAt ASC, then EVENT_ORDER ASC, then id ASC
    events.sort((a, b) => {
      const timeA = new Date(a.createdAt).getTime();
      const timeB = new Date(b.createdAt).getTime();
      if (timeA !== timeB) return timeA - timeB;

      const orderA = EVENT_ORDER[a.type];
      const orderB = EVENT_ORDER[b.type];
      if (orderA !== orderB) return orderA - orderB;

      return a.id.localeCompare(b.id);
    });

    return {
      rootAnalysisId: chain[0].id,
      currentAnalysisId,
      depth: chain.length - 1,
      events,
    };
  }
}
