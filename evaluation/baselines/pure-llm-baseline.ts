import type { BaselineRun, EvaluationCase } from '../types';

export function runPureLlmBaseline(cases: EvaluationCase[]): BaselineRun {
  return {
    baselineId: 'pure-llm-baseline',
    mode: 'manual',
    status: 'SKIPPED',
    notes:
      'Manual lane only. This baseline requires an explicitly configured real provider and prompt protocol, so it is intentionally skipped in the default reproducible scaffold.',
    predictions: cases.map((evaluationCase) => ({
      caseId: evaluationCase.id,
      predictedFiles: [],
      rankedFiles: [],
      evidenceBackedPredictedFiles: [],
      reviewItems: 0,
      notes:
        'Skipped by default to keep the research scaffold deterministic and CI-safe.',
    })),
  };
}
