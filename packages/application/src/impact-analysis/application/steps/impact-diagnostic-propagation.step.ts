import { createHash } from 'node:crypto';
import { DiagnosticRiskEvaluator } from '../../domain/diagnostic-risk.evaluator';
import type { ImpactEvidenceCollectionResult } from '../../domain/impact-analysis-step.types';
import type { InsightInputParams } from '../../ports/insight.repository.port';
import type { ImpactAnalysisRecord } from '../../ports/impact-analysis.repository.port';

export class ImpactDiagnosticPropagationStep {
  execute(
    analysis: ImpactAnalysisRecord,
    evidenceResult: ImpactEvidenceCollectionResult,
  ): InsightInputParams[] {
    const snapshotDiagnostics = (analysis.snapshot.diagnostics as any[]) || [];
    const requirementText = analysis.requirementRevision.rawText;

    const retrievedFilePaths = new Set(
      evidenceResult.retrievedArtifacts
        .map((r) => evidenceResult.artifactByKey.get(r.artifactKey)?.filePath)
        .filter(Boolean),
    );

    const diagnosticRisks = snapshotDiagnostics
      .filter((d: any) => d.severity === 'WARN' || d.severity === 'ERROR')
      .filter((d: any) => {
        const propagationMode = DiagnosticRiskEvaluator.getPropagationMode(d);
        if (propagationMode === 'NONE') return false;

        if (
          propagationMode === 'LEXICAL' &&
          d.payload?.candidateTerms &&
          DiagnosticRiskEvaluator.isRelevant(requirementText, d.payload.candidateTerms)
        ) {
          return true;
        }

        if (propagationMode === 'CONTEXT') {
          const filePath =
            d.payload?.relativePath || (d.samplePaths && d.samplePaths[0]);
          if (filePath && retrievedFilePaths.has(filePath)) {
            return true;
          }
        }
        return false;
      });

    const uniqueDiagnosticRisks = new Map<string, any>();
    for (const diag of diagnosticRisks) {
      const key = DiagnosticRiskEvaluator.buildStructuredInsightKey(diag);
      if (!uniqueDiagnosticRisks.has(key)) {
        uniqueDiagnosticRisks.set(key, diag);
      }
    }

    const insightInputs: InsightInputParams[] = [];

    for (const diag of uniqueDiagnosticRisks.values()) {
      const structuredKey = DiagnosticRiskEvaluator.buildStructuredInsightKey(diag);
      insightInputs.push({
        impactAnalysisId: analysis.id,
        insightKey: `diag_risk_${diag.code.toLowerCase()}_${createHash('sha256')
          .update(structuredKey)
          .digest('hex')
          .substring(0, 8)}`,
        insightType: 'UNKNOWN',
        certainty: 'UNKNOWN',
        reviewStatus: 'NEEDS_REVIEW',
        confidence: null,
        title: `Unsupported Scanner Pattern: ${diag.code}`,
        description: diag.message,
        reasoning: `The scanner detected an unsupported pattern in ${
          diag.payload?.relativePath || (diag.samplePaths && diag.samplePaths[0]) || 'a file'
        }. This pattern is relevant to the requirement or affected files and must be reviewed manually.`,
        metadata: {
          origin: 'SCANNER_DIAGNOSTIC',
          evidenceMode: 'DIAGNOSTIC_ONLY',
          diagnosticRiskCategory: DiagnosticRiskEvaluator.getPropagationMode(diag),
          diagnosticPayload: diag.payload || {},
        },
      });
    }

    return insightInputs;
  }
}
