import { existsSync } from 'fs';
import { EvaluationPaths } from '../core/paths';
import { readJsonFile, resolveRepoPath } from '../../io';
import type { MetricsReport } from '../../metrics';
import type { CaseSnapshotAlignmentRegistry, DbReadinessFile } from '../alignment/case-snapshot-alignment';

function deepEqual(a: any, b: any): boolean {
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch {
    return false;
  }
}

export function validateResults(): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // 1. Verify DB Readiness Probe
  const readinessPath = resolveRepoPath(EvaluationPaths.resultsV0.probes + '/db-snapshot-readiness.v0.json');
  let readiness: DbReadinessFile | null = null;
  if (existsSync(readinessPath)) {
    readiness = readJsonFile<DbReadinessFile>(readinessPath);
    if (readiness.status === 'NO_DATABASE_URL' || readiness.status === 'DB_UNAVAILABLE') {
      errors.push(`DB Readiness status is ${readiness.status}, which must not be committed.`);
    }

    // Verify Legacy Alias Equality
    const legacyPath = resolveRepoPath(EvaluationPaths.resultsLegacy.probes.dbReadinessJson);
    if (existsSync(legacyPath)) {
      const legacy = readJsonFile(legacyPath);
      if (!deepEqual(readiness, legacy)) {
        errors.push('Legacy alias for db-snapshot-readiness does not match canonical output.');
      }
    }
  }

  // 2. Verify Alignment
  const alignmentPath = resolveRepoPath(EvaluationPaths.resultsV0.alignment + '/case-snapshot-alignment.v0.json');
  let alignment: CaseSnapshotAlignmentRegistry | null = null;
  let case006AlignmentClean = false;

  if (existsSync(alignmentPath)) {
    alignment = readJsonFile<CaseSnapshotAlignmentRegistry>(alignmentPath);
    
    // Legacy alias check
    const legacyPath = resolveRepoPath(EvaluationPaths.resultsLegacy.alignment.alignmentJson);
    if (existsSync(legacyPath)) {
      if (!deepEqual(alignment, readJsonFile(legacyPath))) {
        errors.push('Legacy alias for case-snapshot-alignment does not match canonical output.');
      }
    }

    const case006 = alignment.cases.find(c => c.caseId === 'reqimpact-case-006-squareboat-default-includes');
    if (case006) {
      if (case006.status !== 'ALIGNED_VECTOR_READY') {
        errors.push(`Case006 alignment status is ${case006.status}, expected ALIGNED_VECTOR_READY.`);
      }
      if (!case006.cleanRetrievalEligible) {
        errors.push(`Case006 alignment cleanRetrievalEligible is false, expected true.`);
      } else {
        case006AlignmentClean = true;
      }
      if (case006.scannerCoverageStatus !== 'OK') {
        errors.push(`Case006 alignment scannerCoverageStatus is ${case006.scannerCoverageStatus}, expected OK.`);
      }
      if (case006.chunkCount !== 67) {
        errors.push(`Case006 alignment chunkCount is ${case006.chunkCount}, expected 67.`);
      }
    } else {
      errors.push('Case006 is missing from alignment results.');
    }
  }

  // 3. Verify case006 semantic invariants & cross-checks
  const case006SamplePath = resolveRepoPath(EvaluationPaths.resultsV0.samples + '/current-hybrid/case006.v0.json');
  let case006SampleOk = false;

  if (existsSync(case006SamplePath)) {
    const case006Sample: any = readJsonFile(case006SamplePath);
    
    // Legacy alias check
    const legacyPath = resolveRepoPath(EvaluationPaths.resultsLegacy.samples.currentHybridJson);
    if (existsSync(legacyPath)) {
      if (!deepEqual(case006Sample, readJsonFile(legacyPath))) {
        errors.push('Legacy alias for case006 current-hybrid sample does not match canonical output.');
      }
    }

    if (case006Sample.mode !== 'CURRENT_HYBRID_BENCHMARK') {
      errors.push(`case006 sample mode is ${case006Sample.mode}, expected CURRENT_HYBRID_BENCHMARK`);
    }
    if (case006Sample.caseId !== 'reqimpact-case-006-squareboat-default-includes') {
      errors.push(`case006 sample caseId mismatch: ${case006Sample.caseId}`);
    }
    if (case006Sample.embeddingState?.alignmentVerified !== true) {
      errors.push('case006 sample alignmentVerified is not true');
    }
    if (case006Sample.groundTruthCoverage?.status !== 'OK') {
      errors.push(`case006 sample groundTruthCoverage.status is ${case006Sample.groundTruthCoverage?.status}, expected OK`);
    } else {
      case006SampleOk = true;
    }
    if (!case006Sample.topK || case006Sample.topK.length === 0) {
      errors.push('case006 sample topK is empty');
    } else {
      const rank1 = case006Sample.topK[0];
      if (rank1.filePath !== 'libs/boat/src/transformers/transformer.ts') {
         errors.push(`case006 sample rank 1 file mismatch: ${rank1.filePath}`);
      }
      if (!rank1.evidence?.isCodeLike) {
         errors.push('case006 sample rank 1 evidence is not code-like');
      }
    }
  } else {
    console.warn('case006.v0.json not found, skipping case006 invariants.');
  }

  // 4. Cross-validations
  if (case006SampleOk) {
    if (alignment && alignment.cleanRetrievalEligibleCount === 0) {
      errors.push('alignment cleanRetrievalEligibleCount = 0 but current-hybrid Case006 benchmark exists and is OK.');
    }
    if (alignment && !case006AlignmentClean) {
      errors.push('Case006 alignment is not clean but current-hybrid sample claims OK.');
    }
  }

  // 5. Verify metrics output
  const metricsPath = resolveRepoPath(EvaluationPaths.resultsV0.analysis + '/metrics.v0.json');
  if (existsSync(metricsPath)) {
    const metrics = readJsonFile<MetricsReport>(metricsPath);
    if (!metrics.runId) errors.push('Metrics missing runId');
    if (!metrics.generatedAt) errors.push('Metrics missing generatedAt');
    if (metrics.dataset?.scannerCoverageFailureCaseCount === undefined) {
      errors.push('Metrics missing dataset.scannerCoverageFailureCaseCount');
    }
    
    const source = metrics.dataset?.scannerCoverageFailureCaseCountSource;
    if (!source) {
      errors.push('Metrics missing dataset.scannerCoverageFailureCaseCountSource');
    } else if (source !== 'DATASET_METADATA' && source !== 'DB_ALIGNMENT') {
      errors.push(`Metrics source ${source} is not a valid enum value.`);
    }

    if (source === 'DB_ALIGNMENT' && alignment) {
      if (metrics.dataset?.scannerCoverageFailureCaseCount !== alignment.scannerCoverageFailureCount) {
        errors.push(`Metrics count (${metrics.dataset?.scannerCoverageFailureCaseCount}) does not match alignment scannerCoverageFailureCount (${alignment.scannerCoverageFailureCount}).`);
      }
    }

    // Verify Legacy Alias
    const legacyPath = resolveRepoPath(EvaluationPaths.resultsLegacy.analysis.metricsJson);
    if (existsSync(legacyPath)) {
      if (!deepEqual(metrics, readJsonFile(legacyPath))) {
        errors.push('Legacy alias for metrics does not match canonical output.');
      }
    }
  } else {
    errors.push('Metrics file missing at canonical path');
  }

  // Verify Failure Analysis Legacy Alias
  const failurePath = resolveRepoPath(EvaluationPaths.resultsV0.analysis + '/failure-analysis.v0.json');
  if (existsSync(failurePath)) {
    const legacyPath = resolveRepoPath(EvaluationPaths.resultsLegacy.analysis.failuresJson);
    if (existsSync(legacyPath)) {
      if (!deepEqual(readJsonFile(failurePath), readJsonFile(legacyPath))) {
        errors.push('Legacy alias for failure-analysis does not match canonical output.');
      }
    }
  }

  // Verify Baseline Legacy Aliases
  const bm25Path = resolveRepoPath(EvaluationPaths.resultsV0.baselines + '/bm25-baseline.v0.json');
  if (existsSync(bm25Path)) {
    const legacyPath = resolveRepoPath(EvaluationPaths.resultsLegacy.baselines.bm25Json);
    if (existsSync(legacyPath)) {
      if (!deepEqual(readJsonFile(bm25Path), readJsonFile(legacyPath))) {
        errors.push('Legacy alias for bm25-baseline does not match canonical output.');
      }
    }
  }

  const keywordPath = resolveRepoPath(EvaluationPaths.resultsV0.baselines + '/keyword-baseline.v0.json');
  if (existsSync(keywordPath)) {
    const legacyPath = resolveRepoPath(EvaluationPaths.resultsLegacy.baselines.keywordJson);
    if (existsSync(legacyPath)) {
      if (!deepEqual(readJsonFile(keywordPath), readJsonFile(legacyPath))) {
        errors.push('Legacy alias for keyword-baseline does not match canonical output.');
      }
    }
  }

  // 6. Verify vector baseline is absent
  const vectorBaselinePath = resolveRepoPath(EvaluationPaths.resultsV0.baselines + '/vector-baseline.v0.json');
  if (existsSync(vectorBaselinePath)) {
    errors.push('vector-baseline.v0.json should remain absent in the committed repository');
  }

  // 7. Verify Manifest
  const manifestPath = resolveRepoPath(EvaluationPaths.resultsV0.manifests + '/latest.manifest.json');
  if (!existsSync(manifestPath)) {
    errors.push('latest.manifest.json is missing.');
  } else {
    const manifest = readJsonFile<any>(manifestPath);
    if (alignment && manifest.dataset?.caseCount !== alignment.caseCount) {
      errors.push(`Manifest case count (${manifest.dataset?.caseCount}) does not match alignment case count (${alignment.caseCount}).`);
    }
  }

  return { valid: errors.length === 0, errors };
}
