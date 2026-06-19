import { writeFileSync, existsSync } from 'fs';
import { dirname } from 'path';
import { readJsonFile, resolveRepoPath } from '../io';
import { EvaluationPaths } from '../src/core/paths';
import { writeResult } from '../src/core/write-result';

function buildSubset() {
  const casesPath = resolveRepoPath(EvaluationPaths.datasetV0.cases);
  const alignmentPath = resolveRepoPath(EvaluationPaths.resultsV0.alignment + '/case-snapshot-alignment.v0.json');

  if (!existsSync(casesPath) || !existsSync(alignmentPath)) {
    throw new Error('Required dataset or alignment file missing.');
  }

  const casesData = readJsonFile<any>(casesPath);
  const alignmentData = readJsonFile<any>(alignmentPath);

  const includedCases: string[] = [];
  const excludedCases: any[] = [];

  for (const caseDef of casesData.cases) {
    const caseAlign = alignmentData.cases.find((c: any) => c.caseId === caseDef.id);
    const reasonCodes: string[] = [];

    if (!caseAlign) {
      reasonCodes.push('SNAPSHOT_MISSING');
    } else {
      if (caseAlign.status !== 'ALIGNED_VECTOR_READY') {
        reasonCodes.push('NOT_ALIGNED_VECTOR_READY');
      }
      if (!caseAlign.snapshotId) {
        reasonCodes.push('SNAPSHOT_MISSING');
      }
      if (caseAlign.indexStatus !== 'VECTOR_READY') {
        reasonCodes.push('INDEX_STATUS_NOT_VECTOR_READY');
      }
      if (!caseAlign.chunkCount || caseAlign.chunkCount === 0) {
        reasonCodes.push('NO_CHUNKS');
      }
      if (!caseAlign.selectedEmbeddingProfileId) {
        reasonCodes.push('MISSING_SELECTED_EMBEDDING_PROFILE');
      }
      if (!caseAlign.embeddingProviders || caseAlign.embeddingProviders.length === 0) {
        reasonCodes.push('MISSING_EMBEDDING_PROVIDER');
      }
      if (!caseAlign.embeddingModels || caseAlign.embeddingModels.length === 0) {
        reasonCodes.push('MISSING_EMBEDDING_MODEL');
      }
      if (!caseAlign.embeddingDimensions || caseAlign.embeddingDimensions.length === 0) {
        reasonCodes.push('MISSING_EMBEDDING_DIMENSIONS');
      }
      if (caseAlign.missingIndexedGroundTruthFiles && caseAlign.missingIndexedGroundTruthFiles.length > 0) {
        reasonCodes.push('GROUND_TRUTH_NOT_INDEXED');
      }
      if (caseAlign.cleanRetrievalEligible !== true) {
        reasonCodes.push('NOT_CLEAN_RETRIEVAL_ELIGIBLE');
      }
      if (caseAlign.scannerCoverageStatus !== 'OK') {
        reasonCodes.push('SCANNER_COVERAGE_NOT_OK');
      }
    }

    if (reasonCodes.length === 0) {
      includedCases.push(caseDef.id);
    } else {
      excludedCases.push({
        caseId: caseDef.id,
        reasonCodes,
        reason: 'Case failed one or more eligibility rules for clean vector retrieval.'
      });
    }
  }

  const subsetData = {
    subsetId: 'clean-vector-ready-v0',
    datasetVersion: 'v0',
    generatedAt: new Date().toISOString(),
    purpose: 'Common fair retrieval subset for future aggregate retrieval comparison',
    eligibilityRules: {
      alignmentStatus: 'ALIGNED_VECTOR_READY',
      cleanRetrievalEligible: true,
      scannerCoverageStatus: 'OK',
      requiresSnapshot: true,
      requiresVectorIndex: true,
      requiresEmbeddingProfile: true,
      requiresIndexedGroundTruth: true
    },
    caseIds: includedCases,
    excludedCases,
    counts: {
      totalCases: casesData.cases.length,
      eligibleCases: includedCases.length,
      excludedCases: excludedCases.length
    },
    knownLimits: [
      'Clean vector-ready subset size is small and not representative of the full dataset.',
      'Changed files are proxy ground truth',
      'No aggregate vector-only baseline is published in E11B.'
    ]
  };

  const mdLines = [
    '# Clean Vector-Ready Subset',
    '',
    `Subset ID: \`${subsetData.subsetId}\``,
    `Dataset Version: \`${subsetData.datasetVersion}\``,
    `Generated At: \`${subsetData.generatedAt}\``,
    '',
    '## Purpose',
    subsetData.purpose,
    '',
    '## Counts',
    `- Total Cases: ${subsetData.counts.totalCases}`,
    `- Eligible Cases: ${subsetData.counts.eligibleCases}`,
    `- Excluded Cases: ${subsetData.counts.excludedCases}`,
    '',
    '## Included Cases',
    ...subsetData.caseIds.map(id => `- ${id}`),
    '',
    '## Excluded Cases',
    '| Case ID | Reason Codes |',
    '| --- | --- |',
    ...subsetData.excludedCases.map(c => `| ${c.caseId} | ${c.reasonCodes.join(', ')} |`),
    '',
    '## Known Limits',
    ...subsetData.knownLimits.map(l => `- ${l}`)
  ];

  writeResult({
    canonicalJsonPath: EvaluationPaths.datasetV0.subsets + '/clean-vector-ready.v0.json',
    canonicalMarkdownPath: EvaluationPaths.datasetV0.subsets + '/clean-vector-ready.v0.md',
    jsonData: subsetData,
    markdownData: mdLines.join('\n')
  });

  updateManifest();
}

function updateManifest() {
  const manifestPath = resolveRepoPath(EvaluationPaths.resultsV0.manifests + '/latest.manifest.json');
  if (existsSync(manifestPath)) {
    const manifest = readJsonFile<any>(manifestPath);
    
    // Ensure canonicalArtifacts object exists
    manifest.canonicalArtifacts = manifest.canonicalArtifacts || {};
    manifest.canonicalArtifacts.cleanVectorReadySubset = 'evaluation/datasets/v0/subsets/clean-vector-ready.v0.json';
    
    // Make notMeasuredYet idempotent
    const notMeasuredYet = new Set(manifest.notMeasuredYet || []);
    notMeasuredYet.add('vector-only-baseline-v0');
    notMeasuredYet.add('r1-structured-embedding');
    notMeasuredYet.add('aggregate-current-hybrid-on-clean-subset-v0');
    manifest.notMeasuredYet = Array.from(notMeasuredYet);
    
    writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
  }
}

function main() {
  try {
    buildSubset();
    console.log('Successfully built clean-vector-ready subset.');
  } catch (error) {
    console.error('[ERROR] Failed to build clean-vector-ready subset:', error);
    process.exit(1);
  }
}

main();
