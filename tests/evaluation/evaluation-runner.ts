import { EvaluationCase, EvaluationSummaryReport, CaseScoreReport, NormalizedEvaluationResult } from './evaluation-types';
import {
  computeArtifactRecall,
  computeArtifactPrecision,
  computeEvidenceCoverage,
  computeNegativeControl,
  computeConceptCoverage
} from './evaluation-scoring';

export interface EvaluationAdapter {
  evaluateCase(evalCase: EvaluationCase): Promise<NormalizedEvaluationResult>;
}

export class EvaluationRunner {
  constructor(private readonly adapter: EvaluationAdapter) {}

  async run(cases: EvaluationCase[]): Promise<{ report: EvaluationSummaryReport; textSummary: string }> {
    let totalArtifactRecall = 0;
    let totalArtifactPrecision = 0;
    let totalEvidenceCoverage = 0;
    let totalQaCoverage = 0;

    const caseReports: CaseScoreReport[] = [];
    const failedCases: string[] = [];

    for (const evalCase of cases) {
      const result = await this.adapter.evaluateCase(evalCase);
      
      const recall = computeArtifactRecall(evalCase.expected.impactedArtifactKeys, result.foundImpactedArtifactKeys);
      const precision = computeArtifactPrecision(evalCase.expected.impactedArtifactKeys, result.foundImpactedArtifactKeys);
      const evidenceCov = computeEvidenceCoverage(evalCase.expected.impactedArtifactKeys, result.foundImpactedArtifactKeys, result.evidenceByArtifactKey);
      const negativeControl = computeNegativeControl(evalCase.expected.negativeArtifactKeys, result.foundImpactedArtifactKeys);
      
      const unknownsMatch = computeConceptCoverage(evalCase.expected.unknownsOrQuestions, result.unknownsOrQuestions);
      const risksMatch = computeConceptCoverage(evalCase.expected.risks, result.risks);
      const qaMatch = computeConceptCoverage(evalCase.expected.qaScenarios, result.qaScenarios);

      // Add to totals for averages
      totalArtifactRecall += recall.score;
      totalArtifactPrecision += precision.score;
      totalEvidenceCoverage += evidenceCov;
      totalQaCoverage += qaMatch.score;

      const report: CaseScoreReport = {
        caseId: evalCase.id,
        artifactRecall: `${(recall.score * 100).toFixed(1)}% (${evalCase.expected.impactedArtifactKeys.length - recall.missing.length}/${evalCase.expected.impactedArtifactKeys.length})`,
        artifactPrecision: `${(precision.score * 100).toFixed(1)}% (${result.foundImpactedArtifactKeys.length - precision.unexpected.length}/${result.foundImpactedArtifactKeys.length})`,
        missingExpectedArtifacts: recall.missing,
        unexpectedArtifacts: precision.unexpected,
        negativeArtifactsFailed: negativeControl.failedKeys,
        evidenceCoverage: `${(evidenceCov * 100).toFixed(1)}%`,
        unknownsMatched: `${unknownsMatch.matched}/${unknownsMatch.total}`,
        risksMatched: `${risksMatch.matched}/${risksMatch.total}`,
        qaScenariosMatched: `${qaMatch.matched}/${qaMatch.total}`,
      };

      caseReports.push(report);

      // Simple heuristic for failing cases: if recall < 100% or negative artifacts leaked
      if (recall.score < 1.0 || !negativeControl.passed) {
        failedCases.push(evalCase.id);
      }
    }

    const reportObj: EvaluationSummaryReport = {
      totalCases: cases.length,
      averageArtifactRecall: `${cases.length > 0 ? (totalArtifactRecall / cases.length * 100).toFixed(1) : 0}%`,
      averageArtifactPrecision: `${cases.length > 0 ? (totalArtifactPrecision / cases.length * 100).toFixed(1) : 0}%`,
      averageEvidenceCoverage: `${cases.length > 0 ? (totalEvidenceCoverage / cases.length * 100).toFixed(1) : 0}%`,
      averageQaCoverage: `${cases.length > 0 ? (totalQaCoverage / cases.length * 100).toFixed(1) : 0}%`,
      failedCases,
      cases: caseReports,
    };

    let textSummary = `Evaluation Summary\n`;
    textSummary += `- total cases: ${reportObj.totalCases}\n`;
    textSummary += `- average artifact recall: ${reportObj.averageArtifactRecall}\n`;
    textSummary += `- average artifact precision: ${reportObj.averageArtifactPrecision}\n`;
    textSummary += `- average evidence coverage: ${reportObj.averageEvidenceCoverage}\n`;
    textSummary += `- average QA coverage: ${reportObj.averageQaCoverage}\n`;
    textSummary += `- failed cases: ${reportObj.failedCases.length > 0 ? reportObj.failedCases.join(', ') : 'None'}\n\n`;

    for (const cr of caseReports) {
      textSummary += `Case: ${cr.caseId}\n`;
      textSummary += `- artifact recall: ${cr.artifactRecall}\n`;
      textSummary += `- artifact precision: ${cr.artifactPrecision}\n`;
      if (cr.missingExpectedArtifacts.length > 0) {
        textSummary += `- missing expected artifacts: ${cr.missingExpectedArtifacts.join(', ')}\n`;
      }
      if (cr.unexpectedArtifacts.length > 0) {
        textSummary += `- unexpected artifacts: ${cr.unexpectedArtifacts.join(', ')}\n`;
      }
      if (cr.negativeArtifactsFailed.length > 0) {
        textSummary += `- leaked negative artifacts: ${cr.negativeArtifactsFailed.join(', ')}\n`;
      }
      textSummary += `- evidence coverage: ${cr.evidenceCoverage}\n`;
      textSummary += `- unknowns matched: ${cr.unknownsMatched}\n`;
      textSummary += `- QA scenarios matched: ${cr.qaScenariosMatched}\n\n`;
    }

    return {
      report: reportObj,
      textSummary: textSummary.trim(),
    };
  }
}
