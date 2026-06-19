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

  // Helper to verify metrics
  function verifyMetricsRecomputable(artifact: any, name: string) {
    if (!artifact.results || !artifact.metrics) return;
    let h1 = 0, h5 = 0, h10 = 0, sumRR = 0;
    const count = artifact.caseCount;
    if (count === 0) return;

    artifact.results.forEach((r: any) => {
      let firstRank = -1;
      r.topK.forEach((k: any) => {
        if (firstRank === -1 && r.groundTruthFiles.includes(k.filePath)) {
          firstRank = k.rank;
        }
      });
      if (firstRank === 1) h1++;
      if (firstRank !== -1 && firstRank <= 5) h5++;
      if (firstRank !== -1 && firstRank <= 10) h10++;
      if (firstRank !== -1) sumRR += (1 / firstRank);
    });

    const eps = 0.0001;
    if (Math.abs(artifact.metrics.hitAt1 - (h1 / count)) > eps) errors.push(`${name} hitAt1 not recomputable`);
    if (Math.abs(artifact.metrics.hitAt5 - (h5 / count)) > eps) errors.push(`${name} hitAt5 not recomputable`);
    if (Math.abs(artifact.metrics.hitAt10 - (h10 / count)) > eps) errors.push(`${name} hitAt10 not recomputable`);
    if (Math.abs(artifact.metrics.mrr - (sumRR / count)) > eps) errors.push(`${name} mrr not recomputable`);
  }

  // 6. Verify vector baseline
  const vectorBaselinePath = resolveRepoPath(EvaluationPaths.resultsV0.baselines + '/vector-baseline.v0.json');
  if (existsSync(vectorBaselinePath)) {
    const vBaseline = readJsonFile<any>(vectorBaselinePath);
    if (vBaseline.method !== 'VECTOR_ONLY') errors.push('vector-baseline method must be VECTOR_ONLY');
    if (vBaseline.datasetVersion !== 'v0') errors.push('vector-baseline datasetVersion must be v0');
    if (vBaseline.subsetId !== 'clean-vector-ready-v0') errors.push('vector-baseline subsetId must be clean-vector-ready-v0');
    
    verifyMetricsRecomputable(vBaseline, 'vector-baseline');
    
    const subsetPath = resolveRepoPath(EvaluationPaths.datasetV0.subsets + '/clean-vector-ready.v0.json');
    if (existsSync(subsetPath)) {
      const subset = readJsonFile<any>(subsetPath);
      if (vBaseline.caseCount !== subset.caseIds.length) errors.push('vector-baseline caseCount must match subset caseIds length');
      if (vBaseline.caseCount !== subset.counts.eligibleCases) errors.push('vector-baseline caseCount must match subset eligibleCases');
      
      const baselineIdsStr = JSON.stringify([...vBaseline.caseIds].sort());
      const subsetIdsStr = JSON.stringify([...subset.caseIds].sort());
      if (baselineIdsStr !== subsetIdsStr) errors.push('vector-baseline caseIds must exactly match subset caseIds');
      
      if (!vBaseline.results || vBaseline.results.length !== vBaseline.caseCount) errors.push('vector-baseline results length must match caseCount');
      
      vBaseline.results.forEach((r: any) => {
        if (!subset.caseIds.includes(r.caseId)) errors.push(`vector-baseline result caseId ${r.caseId} not in subset`);
        if (r.retrievalMode !== 'VECTOR_ONLY') errors.push(`vector-baseline result ${r.caseId} retrievalMode must be VECTOR_ONLY`);
        
        r.topK.forEach((k: any) => {
          if (k.finalScore !== k.vectorScore) errors.push(`vector-baseline result ${r.caseId} file ${k.filePath} finalScore must equal vectorScore`);
          if (k.lexicalScore !== 0) errors.push(`vector-baseline result ${r.caseId} file ${k.filePath} lexicalScore must be 0`);
          if (k.graphScore !== 0) errors.push(`vector-baseline result ${r.caseId} file ${k.filePath} graphScore must be 0`);
          
          const signals = k.signals || [];
          if (signals.length !== 1 || signals[0] !== 'VECTOR') {
            errors.push(`vector-baseline result ${r.caseId} file ${k.filePath} must have exactly one signal: VECTOR`);
          }
        });
      });
    }

    const hasSubsetSizeWarning = vBaseline.knownLimits?.some((l: string) => l.toLowerCase().includes('subset size') && l.toLowerCase().includes('not representative'));
    const hasCrossMethodWarning = vBaseline.knownLimits?.some((l: string) => l.toLowerCase().includes('cross-method comparison'));
    if (!hasSubsetSizeWarning || !hasCrossMethodWarning) {
      errors.push('vector-baseline knownLimits must include warnings about subset size and no cross-method comparison');
    }
  }

  // 6.2 Verify current hybrid baseline
  const hybridBaselinePath = resolveRepoPath(EvaluationPaths.resultsV0.baselines + '/current-hybrid-clean-subset-baseline.v0.json');
  if (existsSync(hybridBaselinePath)) {
    const hBaseline = readJsonFile<any>(hybridBaselinePath);
    if (hBaseline.method !== 'CURRENT_HYBRID') errors.push('current-hybrid-baseline method must be CURRENT_HYBRID');
    if (hBaseline.datasetVersion !== 'v0') errors.push('current-hybrid-baseline datasetVersion must be v0');
    if (hBaseline.subsetId !== 'clean-vector-ready-v0') errors.push('current-hybrid-baseline subsetId must be clean-vector-ready-v0');
    if (hBaseline.retrievalConfig?.retrievalMode !== 'HYBRID') errors.push('current-hybrid-baseline retrievalConfig.retrievalMode must be HYBRID');
    if (hBaseline.retrievalConfig?.expandGraph !== true) errors.push('current-hybrid-baseline retrievalConfig.expandGraph must be true');

    verifyMetricsRecomputable(hBaseline, 'current-hybrid-baseline');

    const subsetPath = resolveRepoPath(EvaluationPaths.datasetV0.subsets + '/clean-vector-ready.v0.json');
    if (existsSync(subsetPath)) {
      const subset = readJsonFile<any>(subsetPath);
      if (hBaseline.caseCount !== subset.caseIds.length) errors.push('current-hybrid-baseline caseCount must match subset caseIds length');
      
      const baselineIdsStr = JSON.stringify([...hBaseline.caseIds].sort());
      const subsetIdsStr = JSON.stringify([...subset.caseIds].sort());
      if (baselineIdsStr !== subsetIdsStr) errors.push('current-hybrid-baseline caseIds must exactly match subset caseIds');
      
      hBaseline.results.forEach((r: any) => {
        if (!subset.caseIds.includes(r.caseId)) errors.push(`current-hybrid-baseline result caseId ${r.caseId} not in subset`);
        if (r.retrievalMode !== 'HYBRID') errors.push(`current-hybrid-baseline result ${r.caseId} retrievalMode must be HYBRID`);
        
        r.topK.forEach((k: any) => {
          if (typeof k.rank !== 'number' || k.rank < 1) errors.push(`current-hybrid-baseline result ${r.caseId} file ${k.filePath} must have valid rank`);
          if (!k.filePath) errors.push(`current-hybrid-baseline result ${r.caseId} has item without filePath`);
          if (typeof k.score !== 'number' || typeof k.finalScore !== 'number') errors.push(`current-hybrid-baseline result ${r.caseId} file ${k.filePath} must have numeric score/finalScore`);
          if (!Array.isArray(k.signals)) errors.push(`current-hybrid-baseline result ${r.caseId} file ${k.filePath} must have signals array`);
        });
      });
    }

    const hasSubsetSizeWarning = hBaseline.knownLimits?.some((l: string) => l.toLowerCase().includes('subset size') && l.toLowerCase().includes('not representative'));
    const hasCrossMethodWarning = hBaseline.knownLimits?.some((l: string) => l.toLowerCase().includes('cross-method comparison'));
    if (!hasSubsetSizeWarning || !hasCrossMethodWarning) {
      errors.push('current-hybrid-baseline knownLimits must include warnings about subset size and no cross-method comparison');
    }
  }

  // 6.3 Verify Keyword Baseline
  const keywordBaselinePath = resolveRepoPath(EvaluationPaths.resultsV0.baselines + '/keyword-clean-subset-baseline.v0.json');
  if (existsSync(keywordBaselinePath)) {
    const kBaseline = readJsonFile<any>(keywordBaselinePath);
    if (kBaseline.method !== 'KEYWORD') errors.push('keyword-baseline method must be KEYWORD');
    if (kBaseline.datasetVersion !== 'v0') errors.push('keyword-baseline datasetVersion must be v0');
    if (kBaseline.subsetId !== 'clean-vector-ready-v0') errors.push('keyword-baseline subsetId must be clean-vector-ready-v0');

    verifyMetricsRecomputable(kBaseline, 'keyword-baseline');

    const subsetPath = resolveRepoPath(EvaluationPaths.datasetV0.subsets + '/clean-vector-ready.v0.json');
    if (existsSync(subsetPath)) {
      const subset = readJsonFile<any>(subsetPath);
      if (kBaseline.caseCount !== subset.caseIds.length) errors.push('keyword-baseline caseCount must match subset caseIds length');
      
      const baselineIdsStr = JSON.stringify([...kBaseline.caseIds].sort());
      const subsetIdsStr = JSON.stringify([...subset.caseIds].sort());
      if (baselineIdsStr !== subsetIdsStr) errors.push('keyword-baseline caseIds must exactly match subset caseIds');
      
      if (!kBaseline.results || kBaseline.results.length !== kBaseline.caseCount) errors.push('keyword-baseline results length must match caseCount');

      kBaseline.results.forEach((r: any) => {
        if (!subset.caseIds.includes(r.caseId)) errors.push(`keyword-baseline result caseId ${r.caseId} not in subset`);
        if (r.retrievalMode !== 'KEYWORD') errors.push(`keyword-baseline result ${r.caseId} retrievalMode must be KEYWORD`);
        
        r.topK.forEach((k: any) => {
          if (k.finalScore !== k.lexicalScore) errors.push(`keyword-baseline result ${r.caseId} file ${k.filePath} finalScore must equal lexicalScore`);
          if (k.vectorScore !== 0) errors.push(`keyword-baseline result ${r.caseId} file ${k.filePath} vectorScore must be 0`);
          if (k.graphScore !== 0) errors.push(`keyword-baseline result ${r.caseId} file ${k.filePath} graphScore must be 0`);
          
          const signals = k.signals || [];
          if (signals.length !== 1 || signals[0] !== 'KEYWORD') {
            errors.push(`keyword-baseline result ${r.caseId} file ${k.filePath} must have exactly one signal: KEYWORD`);
          }
        });
      });
    }

    const hasSubsetSizeWarning = kBaseline.knownLimits?.some((l: string) => l.toLowerCase().includes('subset size') && l.toLowerCase().includes('not representative'));
    const hasCrossMethodWarning = kBaseline.knownLimits?.some((l: string) => l.toLowerCase().includes('cross-method comparison'));
    if (!hasSubsetSizeWarning || !hasCrossMethodWarning) {
      errors.push('keyword-baseline knownLimits must include warnings about subset size and no cross-method comparison');
    }
  }

  // 6.4 Verify BM25 Baseline
  const bm25BaselinePath = resolveRepoPath(EvaluationPaths.resultsV0.baselines + '/bm25-clean-subset-baseline.v0.json');
  if (existsSync(bm25BaselinePath)) {
    const bBaseline = readJsonFile<any>(bm25BaselinePath);
    if (bBaseline.method !== 'BM25') errors.push('bm25-baseline method must be BM25');
    if (bBaseline.datasetVersion !== 'v0') errors.push('bm25-baseline datasetVersion must be v0');
    if (bBaseline.subsetId !== 'clean-vector-ready-v0') errors.push('bm25-baseline subsetId must be clean-vector-ready-v0');

    verifyMetricsRecomputable(bBaseline, 'bm25-baseline');

    const subsetPath = resolveRepoPath(EvaluationPaths.datasetV0.subsets + '/clean-vector-ready.v0.json');
    if (existsSync(subsetPath)) {
      const subset = readJsonFile<any>(subsetPath);
      if (bBaseline.caseCount !== subset.caseIds.length) errors.push('bm25-baseline caseCount must match subset caseIds length');
      
      const baselineIdsStr = JSON.stringify([...bBaseline.caseIds].sort());
      const subsetIdsStr = JSON.stringify([...subset.caseIds].sort());
      if (baselineIdsStr !== subsetIdsStr) errors.push('bm25-baseline caseIds must exactly match subset caseIds');
      
      if (!bBaseline.results || bBaseline.results.length !== bBaseline.caseCount) errors.push('bm25-baseline results length must match caseCount');

      bBaseline.results.forEach((r: any) => {
        if (!subset.caseIds.includes(r.caseId)) errors.push(`bm25-baseline result caseId ${r.caseId} not in subset`);
        if (r.retrievalMode !== 'BM25') errors.push(`bm25-baseline result ${r.caseId} retrievalMode must be BM25`);
        
        r.topK.forEach((k: any) => {
          if (k.finalScore !== k.lexicalScore) errors.push(`bm25-baseline result ${r.caseId} file ${k.filePath} finalScore must equal lexicalScore`);
          if (k.vectorScore !== 0) errors.push(`bm25-baseline result ${r.caseId} file ${k.filePath} vectorScore must be 0`);
          if (k.graphScore !== 0) errors.push(`bm25-baseline result ${r.caseId} file ${k.filePath} graphScore must be 0`);
          
          const signals = k.signals || [];
          if (signals.length !== 1 || signals[0] !== 'BM25') {
            errors.push(`bm25-baseline result ${r.caseId} file ${k.filePath} must have exactly one signal: BM25`);
          }
        });
      });
    }

    const hasSubsetSizeWarning = bBaseline.knownLimits?.some((l: string) => l.toLowerCase().includes('subset size') && l.toLowerCase().includes('not representative'));
    const hasCrossMethodWarning = bBaseline.knownLimits?.some((l: string) => l.toLowerCase().includes('cross-method comparison'));
    if (!hasSubsetSizeWarning || !hasCrossMethodWarning) {
      errors.push('bm25-baseline knownLimits must include warnings about subset size and no cross-method comparison');
    }
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
    if (sample.embeddingState?.profileCompatible !== true) {
      errors.push('vectorOnlyCase006: profileCompatible must be strictly true');
    }
    if (!sample.embeddingState?.queryEmbeddingProfileId || !sample.embeddingState?.documentEmbeddingProfileId) {
      errors.push('vectorOnlyCase006: query and document profile IDs must exist');
    }
    if (!sample.embeddingState?.queryDimensions || sample.embeddingState?.queryDimensions !== sample.embeddingState?.documentDimensions) {
      errors.push('vectorOnlyCase006: query and document dimensions must match and exist');
    }
    if (!sample.topK || sample.topK.length === 0) {
      errors.push('vectorOnlyCase006: topK cannot be empty');
    } else {
      sample.topK.forEach((k: any) => {
        if (k.finalScore !== k.vectorScore) errors.push(`vectorOnlyCase006: finalScore must equal vectorScore for ${k.filePath}`);
        if (k.lexicalScore !== 0) errors.push(`vectorOnlyCase006: lexicalScore must be 0 for ${k.filePath}`);
        if (k.graphScore !== 0) errors.push(`vectorOnlyCase006: graphScore must be 0 for ${k.filePath}`);
        const signals = k.signals || [];
        if (signals.some((s: string) => ['LEXICAL', 'GRAPH', 'DOMAIN', 'KIND'].includes(s))) {
          errors.push(`vectorOnlyCase006: signals must not contain LEXICAL/GRAPH/DOMAIN/KIND for ${k.filePath}`);
        }
        if (!signals.includes('VECTOR')) {
           errors.push(`vectorOnlyCase006: signals must contain VECTOR for ${k.filePath}`);
        }
      });
    }
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

  // 6.6 Verify clean-vector-ready subset
  const subsetPath = resolveRepoPath(EvaluationPaths.datasetV0.subsets + '/clean-vector-ready.v0.json');
  if (existsSync(subsetPath)) {
    const subset = readJsonFile<any>(subsetPath);
    if (subset.subsetId !== 'clean-vector-ready-v0') errors.push('clean-vector-ready subsetId must be clean-vector-ready-v0');
    if (subset.datasetVersion !== 'v0') errors.push('clean-vector-ready datasetVersion must be v0');
    
    const casesPath = resolveRepoPath(EvaluationPaths.datasetV0.cases);
    if (existsSync(casesPath)) {
      const casesData = readJsonFile<any>(casesPath);
      subset.caseIds.forEach((id: string) => {
        if (!casesData.cases.find((c: any) => c.id === id)) errors.push(`clean-vector-ready included case ${id} not found in cases.v0.json`);
      });
    }
    
    if (alignment) {
      subset.caseIds.forEach((id: string) => {
        const c = alignment.cases.find((ac: any) => ac.caseId === id);
        if (!c) errors.push(`clean-vector-ready included case ${id} not found in alignment`);
        else {
          if (c.status !== 'ALIGNED_VECTOR_READY') errors.push(`clean-vector-ready case ${id} status must be ALIGNED_VECTOR_READY`);
          if (c.cleanRetrievalEligible !== true) errors.push(`clean-vector-ready case ${id} cleanRetrievalEligible must be true`);
          if (c.scannerCoverageStatus !== 'OK') errors.push(`clean-vector-ready case ${id} scannerCoverageStatus must be OK`);
        }
      });
    }
    
    subset.excludedCases.forEach((c: any) => {
      if (!c.reasonCodes || c.reasonCodes.length === 0) errors.push(`clean-vector-ready excluded case ${c.caseId} must have reasonCodes`);
      if (!c.reason) errors.push(`clean-vector-ready excluded case ${c.caseId} must have reason`);
    });
    
    if (subset.counts.eligibleCases !== subset.caseIds.length) errors.push('clean-vector-ready counts.eligibleCases mismatch');
    if (subset.counts.excludedCases !== subset.excludedCases.length) errors.push('clean-vector-ready counts.excludedCases mismatch');
    
    const hasSmallSubsetWarning = subset.knownLimits?.some((l: string) => l.toLowerCase().includes('small'));
    const hasNoAggregateWarning = subset.knownLimits?.some((l: string) => l.toLowerCase().includes('no aggregate vector-only baseline'));
    if (!hasSmallSubsetWarning || !hasNoAggregateWarning) {
      errors.push('clean-vector-ready knownLimits must mention "small" subset and "No aggregate vector-only baseline"');
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
    if (existsSync(vectorBaselinePath)) {
      if (manifest.notMeasuredYet?.includes('vector-only-baseline-v0')) {
        errors.push('Manifest notMeasuredYet should NOT include vector-only-baseline-v0');
      }
      if (!manifest.canonicalArtifacts?.vectorBaseline) {
        errors.push('Manifest canonicalArtifacts must include vectorBaseline');
      }
    }
    
    if (existsSync(hybridBaselinePath)) {
      if (manifest.notMeasuredYet?.includes('aggregate-current-hybrid-on-clean-subset-v0')) {
        errors.push('Manifest notMeasuredYet should NOT include aggregate-current-hybrid-on-clean-subset-v0');
      }
      if (!manifest.canonicalArtifacts?.currentHybridCleanSubsetBaseline) {
        errors.push('Manifest canonicalArtifacts must include currentHybridCleanSubsetBaseline');
      }
    } else {
      if (!manifest.notMeasuredYet?.includes('aggregate-current-hybrid-on-clean-subset-v0')) {
        errors.push('Manifest notMeasuredYet MUST include aggregate-current-hybrid-on-clean-subset-v0');
      }
    }
    
    if (existsSync(keywordBaselinePath)) {
      if (!manifest.canonicalArtifacts?.keywordCleanSubsetBaseline) {
        errors.push('Manifest canonicalArtifacts must include keywordCleanSubsetBaseline');
      }
    }
    
    if (existsSync(bm25BaselinePath)) {
      if (!manifest.canonicalArtifacts?.bm25CleanSubsetBaseline) {
        errors.push('Manifest canonicalArtifacts must include bm25CleanSubsetBaseline');
      }
    }
    
    if (alignment && manifest.dataset?.scannerCoverageFailureCount !== alignment.scannerCoverageFailureCount) {
      errors.push(`Manifest scannerCoverageFailureCount (${manifest.dataset?.scannerCoverageFailureCount}) does not match alignment scannerCoverageFailureCount (${alignment.scannerCoverageFailureCount}).`);
    }
    if (!existsSync(vectorBaselinePath)) {
      if (!Array.isArray(manifest.notMeasuredYet) || !manifest.notMeasuredYet.includes('vector-only-baseline-v0')) {
        errors.push('Manifest notMeasuredYet is missing vector-only-baseline-v0.');
      }
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
