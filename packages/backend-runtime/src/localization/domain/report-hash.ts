import * as crypto from 'crypto';
import { MarkdownReportRenderContext } from '../../document/application/markdown-impact-report.types';

/**
 * Computes a deterministic hash of the canonical report context to detect staleness.
 * This ensures that if the source English report data changes, any derived localized
 * artifacts are correctly invalidated.
 */
export function computeCanonicalReportHash(context: MarkdownReportRenderContext): string {
  // We only include the fields that actually affect the text content of the report.
  // We explicitly ignore `locale` since the source is always canonical (usually 'en').
  const hashPayload = {
    analysisId: context.analysis.id,
    requirementRevisionId: context.analysis.requirementRevision.id,
    snapshotId: context.analysis.snapshot.id,
    
    // Insights (Risks, Unknowns, QA Scenarios)
    insights: context.insights.map(i => ({
      id: i.id,
      title: i.title,
      description: i.description,
      insightType: i.insightType,
      certainty: i.certainty,
      reviewStatus: i.reviewStatus,
      evidenceIds: i.evidenceLinks.map(el => el.evidence.id).sort(),
    })).sort((a: any, b: any) => a.id.localeCompare(b.id)),
    
    // Traceability Links (Affected Artifacts)
    traceabilityLinks: context.traceabilityLinks.map(tl => ({
      id: tl.id,
      artifactId: tl.artifact.id,
      linkType: tl.linkType,
      reviewStatus: tl.reviewStatus,
      evidenceIds: tl.evidenceLinks.map(el => el.evidence.id).sort(),
    })).sort((a: any, b: any) => a.id.localeCompare(b.id)),
    
    // Review Notes
    reviewNotes: context.reviewNotes.map(n => ({
      id: n.id,
      body: n.body,
    })).sort((a: any, b: any) => a.id.localeCompare(b.id)),
    
    // Clarifications
    clarifications: context.clarifications.map(c => ({
      id: c.id,
      question: c.question,
      answer: c.answer,
    })).sort((a: any, b: any) => a.id.localeCompare(b.id)),
  };

  const jsonString = JSON.stringify(hashPayload);
  return crypto.createHash('sha256').update(jsonString).digest('hex');
}
