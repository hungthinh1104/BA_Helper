import { writeFileSync, existsSync } from 'fs';
import { readJsonFile, resolveRepoPath } from '../io';
import { EvaluationPaths } from '../src/core/paths';
import { writeResult } from '../src/core/write-result';

function main() {
  const runId = `e13-research-findings-v0:${new Date().toISOString().replace(/[:.]/g, '-')}`;

  try {
    const subsetPath = resolveRepoPath(EvaluationPaths.datasetV0.subsets + '/clean-vector-ready.v0.json');
    if (!existsSync(subsetPath)) throw new Error('Subset file not found: ' + subsetPath);
    const subsetData = readJsonFile<any>(subsetPath);

    const sameSubsetComparisonPath = resolveRepoPath(EvaluationPaths.resultsV0.analysis + '/same-subset-comparison.v0.json');
    if (!existsSync(sameSubsetComparisonPath)) throw new Error('same-subset-comparison.v0.json must exist before building E13.');
    const compData = readJsonFile<any>(sameSubsetComparisonPath);

    // subsetFailureAnalysis
    const excludedCases = subsetData.excludedCases || [];
    const reasonCounts: Record<string, number> = {};
    for (const ec of excludedCases) {
      for (const rc of ec.reasonCodes) {
        reasonCounts[rc] = (reasonCounts[rc] || 0) + 1;
      }
    }

    const subsetFailureAnalysis = {
      excludedCount: excludedCases.length,
      reasonCounts,
      details: excludedCases.map((ec: any) => ({
        caseId: ec.caseId,
        reasonCodes: ec.reasonCodes
      }))
    };

    // evidenceQuality
    const methodObservations = compData.methods.map((m: any) => {
      const isVector = m.method === 'VECTOR_ONLY';
      const isHybrid = m.method === 'CURRENT_HYBRID';
      const isKeyword = m.method === 'KEYWORD';
      const isBm25 = m.method === 'BM25';

      return {
        method: m.method,
        rank1HasGroundTruth: m.metrics.hitAt1 > 0,
        traceableSignals: isVector ? ['VECTOR'] : 
                          isHybrid ? ['LEXICAL', 'VECTOR', 'GRAPH', 'KIND'] :
                          isKeyword ? ['KEYWORD'] : ['BM25']
      };
    });

    const evidenceQuality = {
      methodObservations,
      topKCoverage: 'All evaluated baselines returned topK items for the cases, but the trace signals vary greatly by method.'
    };

    // methodBehaviorNotes
    const methodBehaviorNotes = [
      "VECTOR_ONLY captures purely semantic similarity on Case006.",
      "CURRENT_HYBRID combines lexical patterns, vector scores, and graph expansion.",
      "KEYWORD relies strictly on deterministic overlap with high-weight fields.",
      "BM25 distributes weights based on term frequency and inverted document frequency."
    ];

    // datasetExpansionRecommendation
    const datasetExpansionRecommendation = [
      "Improve Indexing Resilience: Ensure all case ground-truth files are embedded to avoid GROUND_TRUTH_NOT_INDEXED.",
      "Address Scanner Coverage: Ensure framework scanners do not fail or partially skip essential files, avoiding SCANNER_COVERAGE_NOT_OK.",
      "Increase Subsets: Currently at 1/6. We need to stabilize indexing so that at least 3/6 cases are VECTOR_READY to allow for more statistically significant comparisons."
    ];

    const artifactJson = {
      runId,
      generatedAt: new Date().toISOString(),
      method: 'RESEARCH_FINDINGS',
      datasetVersion: 'v0',
      subsetId: 'clean-vector-ready-v0',
      sourceArtifacts: {
        subset: 'evaluation/datasets/v0/subsets/clean-vector-ready.v0.json',
        sameSubsetComparison: 'evaluation/results/v0/analysis/same-subset-comparison.v0.json',
        vectorBaseline: 'evaluation/results/v0/baselines/vector-baseline.v0.json',
        currentHybridBaseline: 'evaluation/results/v0/baselines/current-hybrid-clean-subset-baseline.v0.json',
        keywordBaseline: 'evaluation/results/v0/baselines/keyword-clean-subset-baseline.v0.json',
        bm25Baseline: 'evaluation/results/v0/baselines/bm25-clean-subset-baseline.v0.json'
      },
      subsetFailureAnalysis,
      evidenceQuality,
      methodBehaviorNotes,
      datasetExpansionRecommendation,
      knownLimits: [
        'Findings are based only on clean-vector-ready-v0.',
        'Subset size is 1/6 and not representative of the full dataset.',
        'No method superiority claim is made in E13.'
      ]
    };

    const mdLines = [
      '# E13 Research Findings',
      '',
      `Generated At: \`${artifactJson.generatedAt}\``,
      `Subset: \`${artifactJson.subsetId}\``,
      '',
      '## Subset Failure Analysis',
      `- Excluded Cases: ${subsetFailureAnalysis.excludedCount}`,
      ...Object.entries(subsetFailureAnalysis.reasonCounts).map(([code, count]) => `- \`${code}\`: ${count}`),
      '',
      '## Evidence Quality',
      ...evidenceQuality.methodObservations.map((m: any) => `- \`${m.method}\`: rank1HasGroundTruth=${m.rank1HasGroundTruth}, signals=[${m.traceableSignals.join(', ')}]`),
      '',
      '## Method Behavior Notes',
      ...methodBehaviorNotes.map(n => `- ${n}`),
      '',
      '## Dataset Expansion Recommendation',
      ...datasetExpansionRecommendation.map(r => `- ${r}`),
      '',
      '## Known Limits',
      ...artifactJson.knownLimits.map(l => `- ${l}`)
    ];

    writeResult({
      canonicalJsonPath: EvaluationPaths.resultsV0.analysis + '/e13-research-findings.v0.json',
      canonicalMarkdownPath: EvaluationPaths.resultsV0.analysis + '/e13-research-findings.v0.md',
      runId,
      relativeArtifactPath: 'analysis/e13-research-findings.v0.json',
      jsonData: artifactJson,
      markdownData: mdLines.join('\n')
    });

    updateManifest(runId);
    console.log(`Successfully completed RESEARCH_FINDINGS on ${subsetFailureAnalysis.excludedCount} excluded cases.`);

  } catch (error) {
    console.error('[ERROR] E13 research findings failed: ', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

function updateManifest(runId: string) {
  const manifestPath = resolveRepoPath(EvaluationPaths.resultsV0.manifests + '/latest.manifest.json');
  if (existsSync(manifestPath)) {
    const manifest = readJsonFile<any>(manifestPath);
    
    manifest.canonicalArtifacts = manifest.canonicalArtifacts || {};
    manifest.canonicalArtifacts.e13ResearchFindings = 'evaluation/results/v0/analysis/e13-research-findings.v0.json';
    
    manifest.latestRunId = runId;
    manifest.lastSuccessfulRunId = runId;
    
    writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
  }
}

main();
