import { existsSync } from 'fs';
import { EvaluationPaths } from '../core/paths';
import { readJsonFile, resolveRepoPath } from '../../io';
import type { MetricsReport } from '../../metrics';
import type { CaseSnapshotAlignmentRegistry, DbReadinessFile } from '../alignment/case-snapshot-alignment';

import { semanticEqualForAlias } from '../core/canonicalize';

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
      const legacy = readJsonFile<DbReadinessFile>(legacyPath);
      // If legacy shows DB is unavailable, we intentionally skipped overwriting canonical
      if (legacy.status !== 'NO_DATABASE_URL' && legacy.status !== 'DB_UNAVAILABLE') {
        if (!semanticEqualForAlias(readiness, legacy)) {
          errors.push('Legacy alias for db-snapshot-readiness does not match canonical output.');
        }
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
      // If DB is unavailable, legacy alias will intentionally diverge from frozen canonical output
      const legacyReadinessPath = resolveRepoPath(EvaluationPaths.resultsLegacy.probes.dbReadinessJson);
      let isDbUnavailable = false;
      if (existsSync(legacyReadinessPath)) {
        const legacyReadiness = readJsonFile<DbReadinessFile>(legacyReadinessPath);
        if (legacyReadiness.status === 'NO_DATABASE_URL' || legacyReadiness.status === 'DB_UNAVAILABLE') {
          isDbUnavailable = true;
        }
      }
      
      if (!isDbUnavailable) {
        if (!semanticEqualForAlias(alignment, readJsonFile(legacyPath))) {
          errors.push('Legacy alias for case-snapshot-alignment does not match canonical output.');
        }
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
  const case006SamplePath = resolveRepoPath(EvaluationPaths.resultsV0.samples.currentHybrid + '/case006.v0.json');
  let case006SampleOk = false;

  if (existsSync(case006SamplePath)) {
    const case006Sample: any = readJsonFile(case006SamplePath);
    
    // Legacy alias check
    const legacyPath = resolveRepoPath(EvaluationPaths.resultsLegacy.samples.currentHybridJson);
    if (existsSync(legacyPath)) {
      if (!semanticEqualForAlias(case006Sample, readJsonFile(legacyPath))) {
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
    
    // Check freshness against manifest if DB was ready and it ran in pipeline
    const manifestPath = resolveRepoPath(EvaluationPaths.resultsV0.manifests + '/latest.manifest.json');
    if (existsSync(manifestPath)) {
      const manifest = readJsonFile<any>(manifestPath);
      if (case006Sample.generatedAt && manifest.latestGeneratedAt) {
        const sampleTime = new Date(case006Sample.generatedAt).getTime();
        const manifestTime = new Date(manifest.latestGeneratedAt).getTime();
        const isStale = Math.abs(sampleTime - manifestTime) > 5 * 60 * 1000;
        const isAcceptedStale = manifest.acceptedStaleArtifacts?.includes('currentHybridCase006');
        if (isStale && !isAcceptedStale) {
          errors.push('case006 sample is stale but not explicitly accepted in manifest.');
        }
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
  const metricsMdPath = resolveRepoPath(EvaluationPaths.resultsV0.analysis + '/metrics.v0.md');
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

    if (source === 'DATASET_METADATA' && existsSync(metricsMdPath)) {
      const mdContent = require('fs').readFileSync(metricsMdPath, 'utf8');
      if (!mdContent.includes('Metrics scope limitation') && !mdContent.includes('DATASET_METADATA')) {
        errors.push('Metrics markdown is missing the DATASET_METADATA disclaimer.');
      }
    }

    if (source === 'DB_ALIGNMENT' && alignment) {
      if (metrics.dataset?.scannerCoverageFailureCaseCount !== alignment.scannerCoverageFailureCount) {
        errors.push(`Metrics count (${metrics.dataset?.scannerCoverageFailureCaseCount}) does not match alignment scannerCoverageFailureCount (${alignment.scannerCoverageFailureCount}).`);
      }
    }

    // Verify Legacy Alias
    const legacyPath = resolveRepoPath(EvaluationPaths.resultsLegacy.analysis.metricsJson);
    if (existsSync(legacyPath)) {
      if (!semanticEqualForAlias(metrics, readJsonFile(legacyPath))) {
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
      if (!semanticEqualForAlias(readJsonFile(failurePath), readJsonFile(legacyPath))) {
        errors.push('Legacy alias for failure-analysis does not match canonical output.');
      }
    }
  }

  // Verify Baseline Legacy Aliases
  const bm25Path = resolveRepoPath(EvaluationPaths.resultsV0.baselines + '/bm25-baseline.v0.json');
  if (existsSync(bm25Path)) {
    const legacyPath = resolveRepoPath(EvaluationPaths.resultsLegacy.baselines.bm25Json);
    if (existsSync(legacyPath)) {
      if (!semanticEqualForAlias(readJsonFile(bm25Path), readJsonFile(legacyPath))) {
        errors.push('Legacy alias for bm25-baseline does not match canonical output.');
      }
    }
  }

  const keywordPath = resolveRepoPath(EvaluationPaths.resultsV0.baselines + '/keyword-baseline.v0.json');
  if (existsSync(keywordPath)) {
    const legacyPath = resolveRepoPath(EvaluationPaths.resultsLegacy.baselines.keywordJson);
    if (existsSync(legacyPath)) {
      if (!semanticEqualForAlias(readJsonFile(keywordPath), readJsonFile(legacyPath))) {
        errors.push('Legacy alias for keyword-baseline does not match canonical output.');
      }
    }
  }

  // 6. Verify vector baseline is absent
  const vectorBaselinePath = resolveRepoPath(EvaluationPaths.resultsV0.baselines + '/vector-baseline.v0.json');
  if (existsSync(vectorBaselinePath)) {
    errors.push('vector-baseline.v0.json should remain absent in the committed repository');
  }

  // 6.5 Verify E11A vector-only Case006 probe
  const vectorOnlyPath = resolveRepoPath(EvaluationPaths.resultsV0.samples.vectorOnly + '/case006.v0.json');
  if (existsSync(vectorOnlyPath)) {
    const sample = readJsonFile<any>(vectorOnlyPath);
    if (sample.mode !== 'VECTOR_ONLY_CASE_PROBE') errors.push('vectorOnlyCase006: mode must be VECTOR_ONLY_CASE_PROBE');
    if (sample.caseId !== 'reqimpact-case-006-squareboat-default-includes') errors.push('vectorOnlyCase006: caseId must be Case006');
    if (sample.scope?.type !== 'SINGLE_CASE_PROBE') errors.push('vectorOnlyCase006: scope.type must be SINGLE_CASE_PROBE');
    if (sample.scope?.aggregateBenchmark !== false) errors.push('vectorOnlyCase006: scope.aggregateBenchmark must be false');
    
    if (alignment) {
      const c = alignment.cases.find((c: any) => c.caseId === sample.caseId);
      if (!c || c.status !== 'ALIGNED_VECTOR_READY' || c.cleanRetrievalEligible !== true) {
        errors.push('vectorOnlyCase006: Case006 must be clean and ALIGNED_VECTOR_READY in alignment output');
      }
    }
    
    if (sample.groundTruthCoverage?.status !== 'OK') errors.push('vectorOnlyCase006: groundTruthCoverage must be OK');
    if (sample.embeddingState?.provider === 'fake') errors.push('vectorOnlyCase006: provider cannot be fake');
    if (!sample.embeddingState?.model || /fake|mock|random|hash/i.test(sample.embeddingState.model)) {
      errors.push('vectorOnlyCase006: model cannot be fake/mock');
    }
    if (sample.embeddingState?.queryEmbeddingProfileId === sample.embeddingState?.documentEmbeddingProfileId && !sample.embeddingState?.profileCompatible) {
      errors.push('vectorOnlyCase006: profile Compatible flag should be true');
    }
    if (!sample.topK || sample.topK.length === 0) errors.push('vectorOnlyCase006: topK cannot be empty');
    if (typeof sample.groundTruthHitAtK !== 'boolean') errors.push('vectorOnlyCase006: groundTruthHitAtK must be a boolean');
    if (!sample.knownLimits?.some((l: string) => l.includes('Single-case probe only'))) {
      errors.push('vectorOnlyCase006: knownLimits must explicitly state Single-case probe only');
    }
    if (!sample.oracleCheck?.status) {
      errors.push('vectorOnlyCase006: oracleCheck.status is required');
    } else if (sample.oracleCheck.status === 'PASSED') {
      errors.push('vectorOnlyCase006: oracleCheck cannot be mocked as PASSED');
    }
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
    if (alignment && manifest.dataset?.cleanRetrievalEligibleCount !== alignment.cleanRetrievalEligibleCount) {
      errors.push(`Manifest cleanRetrievalEligibleCount (${manifest.dataset?.cleanRetrievalEligibleCount}) does not match alignment cleanRetrievalEligibleCount (${alignment.cleanRetrievalEligibleCount}).`);
    }
    if (alignment && manifest.dataset?.scannerCoverageFailureCount !== alignment.scannerCoverageFailureCount) {
      errors.push(`Manifest scannerCoverageFailureCount (${manifest.dataset?.scannerCoverageFailureCount}) does not match alignment scannerCoverageFailureCount (${alignment.scannerCoverageFailureCount}).`);
    }
    if (!Array.isArray(manifest.notMeasuredYet) || !manifest.notMeasuredYet.includes('vector-only-baseline-v0')) {
      errors.push('Manifest notMeasuredYet is missing vector-only-baseline-v0.');
    }
    if (!manifest.canonicalArtifacts?.currentHybridCase006) {
      errors.push('Manifest is missing canonicalArtifacts.currentHybridCase006.');
    }
    if (manifest.canonicalArtifacts?.vectorOnlyCase006) {
      if (!existsSync(resolveRepoPath(manifest.canonicalArtifacts.vectorOnlyCase006))) {
        errors.push('vectorOnlyCase006 is in canonicalArtifacts but the file does not exist');
      }
    } else if (!manifest.plannedArtifacts?.vectorOnlyCase006) {
      errors.push('vectorOnlyCase006 must be declared in either canonicalArtifacts or plannedArtifacts');
    }
  }

  return { valid: errors.length === 0, errors };
}
