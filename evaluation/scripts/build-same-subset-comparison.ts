import { writeFileSync, existsSync } from 'fs';
import { readJsonFile, resolveRepoPath } from '../io';
import { EvaluationPaths } from '../src/core/paths';
import { writeResult } from '../src/core/write-result';

function parseArg(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function main() {
  const subsetParam = parseArg('--subset');
  if (subsetParam !== 'clean-vector-ready-v0') {
    console.error('Usage: build-same-subset-comparison.ts --subset clean-vector-ready-v0');
    process.exit(1);
  }

  const runId = `same-subset-comparison-v0:${new Date().toISOString().replace(/[:.]/g, '-')}`;

  try {
    const subsetPath = resolveRepoPath(EvaluationPaths.datasetV0.subsets + '/clean-vector-ready.v0.json');
    if (!existsSync(subsetPath)) throw new Error('Subset file not found: ' + subsetPath);
    const subsetData = readJsonFile<any>(subsetPath);
    const expectedCaseIdsStr = JSON.stringify([...subsetData.caseIds].sort());

    const baselines = [
      { method: 'VECTOR_ONLY', path: EvaluationPaths.resultsV0.baselines + '/vector-baseline.v0.json' },
      { method: 'CURRENT_HYBRID', path: EvaluationPaths.resultsV0.baselines + '/current-hybrid-clean-subset-baseline.v0.json' },
      { method: 'KEYWORD', path: EvaluationPaths.resultsV0.baselines + '/keyword-clean-subset-baseline.v0.json' },
      { method: 'BM25', path: EvaluationPaths.resultsV0.baselines + '/bm25-clean-subset-baseline.v0.json' }
    ];

    const methodsData = [];

    for (const b of baselines) {
      const fullPath = resolveRepoPath(b.path);
      if (!existsSync(fullPath)) {
        throw new Error(`Baseline artifact not found: ${fullPath}`);
      }
      
      const baselineData = readJsonFile<any>(fullPath);
      
      if (baselineData.subsetId !== subsetParam) {
        throw new Error(`Baseline ${b.method} has incorrect subsetId: ${baselineData.subsetId}`);
      }
      
      const actualCaseIdsStr = JSON.stringify([...baselineData.caseIds].sort());
      if (actualCaseIdsStr !== expectedCaseIdsStr) {
        throw new Error(`Baseline ${b.method} caseIds do not match the expected subset caseIds`);
      }

      methodsData.push({
        method: b.method,
        artifact: b.path,
        metrics: baselineData.metrics
      });
    }

    const artifactJson = {
      runId,
      method: 'SAME_SUBSET_COMPARISON',
      datasetVersion: 'v0',
      subsetId: 'clean-vector-ready-v0',
      caseCount: subsetData.caseIds.length,
      caseIds: subsetData.caseIds,
      methods: methodsData,
      comparisonPolicy: {
        sameSubsetRequired: true,
        sameCaseIdsRequired: true,
        winnerAllowed: false,
        interpretation: 'ILLUSTRATIVE_ONLY'
      },
      knownLimits: [
        'Measured only on clean-vector-ready-v0.',
        'Subset size is 1/6 and not representative of the full dataset.',
        'Do not generalize method superiority from this comparison.'
      ]
    };

    const mdLines = [
      '# Same-Subset Comparison Report',
      '',
      `Subset: \`${artifactJson.subsetId}\` (Size: ${artifactJson.caseCount})`,
      '',
      '| Method | Artifact | hitAt1 | hitAt5 | hitAt10 | MRR |',
      '| --- | --- | ---: | ---: | ---: | ---: |'
    ];

    for (const m of methodsData) {
      mdLines.push(`| \`${m.method}\` | \`${m.artifact}\` | ${m.metrics.hitAt1.toFixed(4)} | ${m.metrics.hitAt5.toFixed(4)} | ${m.metrics.hitAt10.toFixed(4)} | ${m.metrics.mrr.toFixed(4)} |`);
    }

    mdLines.push(
      '',
      '## Comparison Policy',
      `- sameSubsetRequired: ${artifactJson.comparisonPolicy.sameSubsetRequired}`,
      `- sameCaseIdsRequired: ${artifactJson.comparisonPolicy.sameCaseIdsRequired}`,
      `- winnerAllowed: ${artifactJson.comparisonPolicy.winnerAllowed}`,
      `- interpretation: ${artifactJson.comparisonPolicy.interpretation}`,
      '',
      '## Known Limits',
      ...artifactJson.knownLimits.map(l => `- ${l}`)
    );

    writeResult({
      canonicalJsonPath: EvaluationPaths.resultsV0.analysis + '/same-subset-comparison.v0.json',
      canonicalMarkdownPath: EvaluationPaths.resultsV0.analysis + '/same-subset-comparison.v0.md',
      runId,
      relativeArtifactPath: 'analysis/same-subset-comparison.v0.json',
      jsonData: artifactJson,
      markdownData: mdLines.join('\n')
    });

    updateManifest(runId);
    console.log(`Successfully completed SAME_SUBSET_COMPARISON over ${methodsData.length} methods.`);

  } catch (error) {
    console.error('[ERROR] same-subset comparison failed: ', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

function updateManifest(runId: string) {
  const manifestPath = resolveRepoPath(EvaluationPaths.resultsV0.manifests + '/latest.manifest.json');
  if (existsSync(manifestPath)) {
    const manifest = readJsonFile<any>(manifestPath);
    
    manifest.canonicalArtifacts = manifest.canonicalArtifacts || {};
    manifest.canonicalArtifacts.sameSubsetComparison = 'evaluation/results/v0/analysis/same-subset-comparison.v0.json';
    
    manifest.latestRunId = runId;
    manifest.lastSuccessfulRunId = runId;
    
    writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
  }
}

main();
