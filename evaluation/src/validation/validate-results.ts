import { existsSync } from 'fs';
import { EvaluationPaths } from '../core/paths';
import { readJsonFile, resolveRepoPath } from '../../io';
import type { MetricsReport } from '../../metrics';

export function validateResults(): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // 1. Verify metrics output
  const metricsPath = resolveRepoPath(EvaluationPaths.resultsV0.analysis + '/metrics.v0.json');
  if (existsSync(metricsPath)) {
    const metrics = readJsonFile<MetricsReport>(metricsPath);
    if (!metrics.runId) errors.push('Metrics missing runId');
    if (!metrics.generatedAt) errors.push('Metrics missing generatedAt');
    if (metrics.dataset?.scannerCoverageFailureCaseCount === undefined) {
      errors.push('Metrics missing dataset.scannerCoverageFailureCaseCount');
    }
  } else {
    errors.push('Metrics file missing at canonical path');
  }

  // 2. Verify case006 semantic invariants
  const case006Path = resolveRepoPath(EvaluationPaths.resultsV0.samples + '/current-hybrid/case006.v0.json');
  if (existsSync(case006Path)) {
    // We don't have a rigid type for this in types yet, so we cast to any
    const case006: any = readJsonFile(case006Path);
    
    if (case006.mode !== 'CURRENT_HYBRID_BENCHMARK') {
      errors.push(`case006 mode is ${case006.mode}, expected CURRENT_HYBRID_BENCHMARK`);
    }
    if (case006.caseId !== 'reqimpact-case-006-squareboat-default-includes') {
      errors.push(`case006 caseId mismatch: ${case006.caseId}`);
    }
    if (case006.embeddingState?.alignmentVerified !== true) {
      errors.push('case006 alignmentVerified is not true');
    }
    if (case006.groundTruthCoverage?.status !== 'OK') {
      errors.push(`case006 groundTruthCoverage.status is ${case006.groundTruthCoverage?.status}, expected OK`);
    }
    if (!case006.topK || case006.topK.length === 0) {
      errors.push('case006 topK is empty');
    } else {
      const rank1 = case006.topK[0];
      if (rank1.filePath !== 'libs/boat/src/transformers/transformer.ts') {
         errors.push(`case006 rank 1 file mismatch: ${rank1.filePath}`);
      }
      if (!rank1.evidence?.isCodeLike) {
         errors.push('case006 rank 1 evidence is not code-like');
      }
    }
  } else {
    // Only warn if it should exist. In CI it might not exist until exported.
    console.warn('case006.v0.json not found, skipping case006 invariants.');
  }

  // 3. Verify vector baseline is absent
  const vectorBaselinePath = resolveRepoPath(EvaluationPaths.resultsV0.baselines + '/vector-baseline.v0.json');
  if (existsSync(vectorBaselinePath)) {
    errors.push('vector-baseline.v0.json should remain absent in the committed repository');
  }

  return { valid: errors.length === 0, errors };
}
