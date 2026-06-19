import { writeFileSync, existsSync } from 'fs';
import { ArtifactRepository } from '../../apps/api/src/modules/artifact/infrastructure/artifact.repository';
import { GoogleEmbeddingProvider } from '../../apps/api/src/modules/embedding/infrastructure/google-embedding.provider';
import { OpenAiEmbeddingProvider } from '../../apps/api/src/modules/embedding/infrastructure/openai-embedding.provider';
import { EmbeddingChunkRepository } from '../../apps/api/src/modules/embedding/infrastructure/embedding-chunk.repository';
import { type EmbeddingProvider } from '../../apps/api/src/modules/embedding/domain/embedding-provider.interface';
import { resolveRuntimeEmbeddingProfileFromEnv } from '../../apps/api/src/modules/embedding/domain/embedding-profile-registry';
import { GraphRepository } from '../../apps/api/src/modules/graph/infrastructure/graph.repository';
import { PrismaService } from '../../apps/api/src/modules/prisma/prisma.service';
import { HybridRetrievalService } from '../../apps/api/src/modules/retrieval/application/hybrid-retrieval.service';
import { readJsonFile, resolveRepoPath } from '../io';
import { EvaluationPaths } from '../src/core/paths';
import { writeResult } from '../src/core/write-result';
import { writeErrorArtifact } from '../src/core/write-error-artifact';

function parseArg(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function resolveRealQueryEmbeddingProvider(): { provider: EmbeddingProvider; model: string; providerName: string } {
  const profile = resolveRuntimeEmbeddingProfileFromEnv('QUERY');
  const providerName = profile.provider;
  switch (providerName) {
    case 'google': return { provider: new GoogleEmbeddingProvider(profile), model: profile.model, providerName };
    case 'openai': return { provider: new OpenAiEmbeddingProvider(profile), model: profile.model, providerName };
    default: throw new Error(`Real query embedding provider "${providerName}" is not supported.`);
  }
}

async function main() {
  const subsetParam = parseArg('--subset');
  if (subsetParam !== 'clean-vector-ready-v0') {
    console.error('Usage: run-current-hybrid-baseline.ts --subset clean-vector-ready-v0');
    process.exit(1);
  }

  const runId = `current-hybrid-clean-subset-baseline-v0:${new Date().toISOString().replace(/[:.]/g, '-')}`;

  try {
    if (!process.env.DATABASE_URL) {
      throw new Error('Hybrid baseline REQUIRES database to be available. Failing fast.');
    }

    const subsetPath = resolveRepoPath(EvaluationPaths.datasetV0.subsets + '/clean-vector-ready.v0.json');
    if (!existsSync(subsetPath)) throw new Error('Subset file not found: ' + subsetPath);
    const subsetData = readJsonFile<any>(subsetPath);

    const alignmentPath = resolveRepoPath(EvaluationPaths.resultsV0.alignment + '/case-snapshot-alignment.v0.json');
    const alignment = readJsonFile<any>(alignmentPath);

    const casesPath = resolveRepoPath(EvaluationPaths.datasetV0.cases);
    const casesData = readJsonFile<any>(casesPath);

    const prisma = new PrismaService();
    await prisma.$connect();

    const { provider, providerName } = resolveRealQueryEmbeddingProvider();
    if (providerName === 'fake') throw new Error('Provider cannot be fake for real hybrid baseline');

    const retrievalService = new HybridRetrievalService(
      new EmbeddingChunkRepository(prisma),
      provider,
      new ArtifactRepository(prisma),
      new GraphRepository(prisma),
      prisma,
    );

    const results = [];
    let hitsAt1 = 0;
    let hitsAt5 = 0;
    let hitsAt10 = 0;
    let sumRR = 0;

    for (const caseId of subsetData.caseIds) {
      const caseDef = casesData.cases.find((c: any) => c.id === caseId);
      const caseAlign = alignment.cases.find((c: any) => c.caseId === caseId);

      if (!caseAlign || caseAlign.status !== 'ALIGNED_VECTOR_READY') {
        throw new Error(`Case ${caseId} is not ALIGNED_VECTOR_READY`);
      }

      const { projectId, repositoryId, snapshotId } = caseAlign;
      const groundTruthFiles = caseDef.groundTruth.files;

      const retrievedArtifacts = await retrievalService.retrieve({
        projectId,
        repositoryId,
        snapshotId,
        changeRequest: caseDef.requirementText,
        maxResults: 20,
        expandGraph: true,
        retrievalMode: 'HYBRID'
      });

      const topK = [];
      let firstRelevantRank = -1;

      for (const [index, retrieved] of retrievedArtifacts.entries()) {
        topK.push({
          rank: index + 1,
          filePath: retrieved.filePath,
          score: retrieved.score,
          finalScore: retrieved.score,
          vectorScore: retrieved.vectorScore || 0,
          lexicalScore: retrieved.lexicalScore || 0,
          graphScore: retrieved.graphScore || 0,
          signals: retrieved.retrievalSignals || []
        });

        if (firstRelevantRank === -1 && groundTruthFiles.includes(retrieved.filePath)) {
          firstRelevantRank = index + 1;
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
        retrievalMode: 'HYBRID',
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
      method: 'CURRENT_HYBRID',
      datasetVersion: 'v0',
      subsetId: 'clean-vector-ready-v0',
      subsetArtifact: 'evaluation/datasets/v0/subsets/clean-vector-ready.v0.json',
      caseCount,
      caseIds: subsetData.caseIds,
      retrievalConfig: {
        retrievalMode: 'HYBRID',
        expandGraph: true
      },
      metrics,
      results,
      knownLimits: [
        'Measured only on clean-vector-ready-v0.',
        'Subset size is small and not representative of the full dataset.',
        'Do not use E12A for cross-method comparison; E12C will compare methods on the same subset.'
      ]
    };

    const mdLines = [
      '# Current-Hybrid Baseline',
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
      canonicalJsonPath: EvaluationPaths.resultsV0.baselines + '/current-hybrid-clean-subset-baseline.v0.json',
      canonicalMarkdownPath: EvaluationPaths.resultsV0.baselines + '/current-hybrid-clean-subset-baseline.v0.md',
      runId,
      relativeArtifactPath: 'baselines/current-hybrid-clean-subset-baseline.v0.json',
      jsonData: artifactJson,
      markdownData: mdLines.join('\n')
    });

    updateManifest(runId);
    
    await prisma.$disconnect();
    console.log(`Successfully completed CURRENT_HYBRID baseline on ${caseCount} cases.`);

  } catch (error) {
    console.error('[ERROR] hybrid baseline failed: ', error instanceof Error ? error.message : error);
    writeErrorArtifact({
      runId,
      name: 'probe-hybrid-baseline.error',
      status: 'PIPELINE_ERROR',
      message: error instanceof Error ? error.message : String(error)
    });
    process.exit(1);
  }
}

function updateManifest(runId: string) {
  const manifestPath = resolveRepoPath(EvaluationPaths.resultsV0.manifests + '/latest.manifest.json');
  if (existsSync(manifestPath)) {
    const manifest = readJsonFile<any>(manifestPath);
    
    manifest.canonicalArtifacts = manifest.canonicalArtifacts || {};
    manifest.canonicalArtifacts.currentHybridCleanSubsetBaseline = 'evaluation/results/v0/baselines/current-hybrid-clean-subset-baseline.v0.json';
    
    if (manifest.notMeasuredYet) {
      manifest.notMeasuredYet = manifest.notMeasuredYet.filter((item: string) => item !== 'aggregate-current-hybrid-on-clean-subset-v0');
    }
    
    manifest.latestRunId = runId;
    manifest.lastSuccessfulRunId = runId;
    
    writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
  }
}

main();
