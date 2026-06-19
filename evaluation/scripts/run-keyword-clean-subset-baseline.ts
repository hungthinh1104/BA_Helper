import { writeFileSync, existsSync } from 'fs';
import { readJsonFile, resolveRepoPath } from '../io';
import { EvaluationPaths } from '../src/core/paths';
import { writeResult } from '../src/core/write-result';
import { rankKeywordArtifacts } from '../baselines/keyword-baseline';

function parseArg(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function main() {
  const subsetParam = parseArg('--subset');
  if (subsetParam !== 'clean-vector-ready-v0') {
    console.error('Usage: run-keyword-clean-subset-baseline.ts --subset clean-vector-ready-v0');
    process.exit(1);
  }

  const runId = `keyword-clean-subset-baseline-v0:${new Date().toISOString().replace(/[:.]/g, '-')}`;

  try {
    const subsetPath = resolveRepoPath(EvaluationPaths.datasetV0.subsets + '/clean-vector-ready.v0.json');
    if (!existsSync(subsetPath)) throw new Error('Subset file not found: ' + subsetPath);
    const subsetData = readJsonFile<any>(subsetPath);

    const casesPath = resolveRepoPath(EvaluationPaths.datasetV0.cases);
    const casesData = readJsonFile<any>(casesPath);

    const results = [];
    let hitsAt1 = 0;
    let hitsAt5 = 0;
    let hitsAt10 = 0;
    let sumRR = 0;

    for (const caseId of subsetData.caseIds) {
      const evaluationCase = casesData.cases.find((c: any) => c.id === caseId);
      if (!evaluationCase) {
        throw new Error(`Case ${caseId} not found in cases.v0.json`);
      }

      const groundTruthFiles = evaluationCase.groundTruth.files;
      const topKRaw = rankKeywordArtifacts({ evaluationCase, topK: 20 });

      const topK = [];
      let firstRelevantRank = -1;

      for (const [index, retrieved] of topKRaw.entries()) {
        const rank = index + 1;
        topK.push({
          rank,
          filePath: retrieved.filePath,
          score: retrieved.score,
          finalScore: retrieved.score,
          vectorScore: 0,
          lexicalScore: retrieved.score,
          graphScore: 0,
          signals: ['KEYWORD']
        });

        if (firstRelevantRank === -1 && groundTruthFiles.includes(retrieved.filePath)) {
          firstRelevantRank = rank;
        }
      }

      const hitAt1 = firstRelevantRank === 1;
      const hitAt5 = firstRelevantRank !== -1 && firstRelevantRank <= 5;
      const hitAt10 = firstRelevantRank !== -1 && firstRelevantRank <= 10;
      const reciprocalRank = firstRelevantRank !== -1 ? 1 / firstRelevantRank : 0;

      if (hitAt1) hitsAt1++;
      if (hitAt5) hitsAt5++;
      if (hitAt10) hitsAt10++;
      sumRR += reciprocalRank;

      results.push({
        caseId,
        retrievalMode: 'KEYWORD',
        groundTruthFiles,
        topK,
        hitAt1,
        hitAt5,
        hitAt10,
        reciprocalRank
      });
    }

    const caseCount = subsetData.caseIds.length;
    const metrics = {
      hitAt1: caseCount > 0 ? hitsAt1 / caseCount : 0,
      hitAt5: caseCount > 0 ? hitsAt5 / caseCount : 0,
      hitAt10: caseCount > 0 ? hitsAt10 / caseCount : 0,
      mrr: caseCount > 0 ? sumRR / caseCount : 0
    };

    const artifactJson = {
      runId,
      generatedAt: new Date().toISOString(),
      method: 'KEYWORD',
      datasetVersion: 'v0',
      subsetId: 'clean-vector-ready-v0',
      subsetArtifact: 'evaluation/datasets/v0/subsets/clean-vector-ready.v0.json',
      caseCount,
      caseIds: subsetData.caseIds,
      metrics,
      results,
      knownLimits: [
        'Measured only on clean-vector-ready-v0.',
        'Subset size is 1/6 and not representative of the full dataset.',
        'Do not use E12B for cross-method comparison; E12C will compare methods on the same subset.'
      ]
    };

    const mdLines = [
      '# Keyword Baseline',
      '',
      `Method: \`${artifactJson.method}\``,
      `Subset: \`${artifactJson.subsetId}\` (Size: ${caseCount})`,
      `Generated At: \`${artifactJson.generatedAt}\``,
      '',
      '## Metrics',
      `hitAt1: ${metrics.hitAt1.toFixed(4)}`,
      `hitAt5: ${metrics.hitAt5.toFixed(4)}`,
      `hitAt10: ${metrics.hitAt10.toFixed(4)}`,
      `mrr: ${metrics.mrr.toFixed(4)}`,
      '',
      '## Known Limits',
      ...artifactJson.knownLimits.map(l => `- ${l}`)
    ];

    writeResult({
      canonicalJsonPath: EvaluationPaths.resultsV0.baselines + '/keyword-clean-subset-baseline.v0.json',
      canonicalMarkdownPath: EvaluationPaths.resultsV0.baselines + '/keyword-clean-subset-baseline.v0.md',
      runId,
      relativeArtifactPath: 'baselines/keyword-clean-subset-baseline.v0.json',
      jsonData: artifactJson,
      markdownData: mdLines.join('\n')
    });

    updateManifest(runId);
    console.log(`Successfully completed KEYWORD baseline on ${caseCount} cases.`);

  } catch (error) {
    console.error('[ERROR] keyword baseline failed: ', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

function updateManifest(runId: string) {
  const manifestPath = resolveRepoPath(EvaluationPaths.resultsV0.manifests + '/latest.manifest.json');
  if (existsSync(manifestPath)) {
    const manifest = readJsonFile<any>(manifestPath);
    
    manifest.canonicalArtifacts = manifest.canonicalArtifacts || {};
    manifest.canonicalArtifacts.keywordCleanSubsetBaseline = 'evaluation/results/v0/baselines/keyword-clean-subset-baseline.v0.json';
    
    manifest.latestRunId = runId;
    manifest.lastSuccessfulRunId = runId;
    
    writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
  }
}

main();
