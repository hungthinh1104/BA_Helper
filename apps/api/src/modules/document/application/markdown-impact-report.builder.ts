import { Injectable } from '@nestjs/common';
import { MermaidImpactDiagramBuilder } from './mermaid-impact-diagram.builder';
import { EvaluationContextAdapter } from './evaluation-context.adapter';
import { MarkdownReportRenderContext } from './markdown-impact-report.types';
import { renderReportHeader } from './markdown-renderers/report-header.renderer';
import { renderExecutiveSummary } from './markdown-renderers/executive-summary.renderer';
import { renderImpactedAreas, renderEvidenceQuality } from './markdown-renderers/traceability-section.renderer';
import { renderImpactsAndAc, renderQuestionsAndClarifications } from './markdown-renderers/insight-section.renderer';
import { renderQaSection } from './markdown-renderers/qa-section.renderer';
import { renderEvidenceAppendix } from './markdown-renderers/evidence-appendix.renderer';
import { renderReviewHistory } from './markdown-renderers/review-history.renderer';
import { renderEvaluationContext } from './markdown-renderers/evaluation-context.renderer';
import { renderImpactDiff } from './markdown-renderers/impact-diff.renderer';

@Injectable()
export class MarkdownImpactReportBuilder {
  constructor(
    private readonly mermaidBuilder: MermaidImpactDiagramBuilder,
    private readonly evalContextAdapter: EvaluationContextAdapter
  ) {}

  build(params: Omit<MarkdownReportRenderContext, 'reviewNotes' | 'dependencyEdges' | 'clarifications' | 'reviewDecisions'> & Partial<Pick<MarkdownReportRenderContext, 'reviewNotes' | 'dependencyEdges' | 'clarifications' | 'reviewDecisions'>>): string {
    const context: MarkdownReportRenderContext = {
      ...params,
      reviewNotes: params.reviewNotes || [],
      dependencyEdges: params.dependencyEdges || [],
      clarifications: params.clarifications || [],
      reviewDecisions: params.reviewDecisions || [],
    };

    const diagramResult = this.mermaidBuilder.build({
      requirement: context.analysis.requirementRevision,
      traceabilityLinks: context.traceabilityLinks,
      dependencyEdges: context.dependencyEdges,
      insights: context.insights,
    });

    const evalContext = this.evalContextAdapter.getEvaluationContext();

    const lines: string[] = [
      ...renderReportHeader(context),
      ...renderExecutiveSummary(context, diagramResult),
      ...renderImpactedAreas(context),
      ...renderImpactsAndAc(context),
      ...renderQaSection(context),
      ...renderQuestionsAndClarifications(context),
      ...renderEvidenceAppendix(context),
      ...renderReviewHistory(context),
      ...renderEvidenceQuality(context),
      ...renderEvaluationContext(evalContext),
      ...renderImpactDiff(context),
    ];

    // Preserve the original trailing whitespace logic
    return lines.join('\n').trim();
  }
}
