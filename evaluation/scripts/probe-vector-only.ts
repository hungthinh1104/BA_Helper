import { ArtifactRepository } from '../../apps/api/src/modules/artifact/infrastructure/artifact.repository';
import { GoogleEmbeddingProvider } from '../../apps/api/src/modules/embedding/infrastructure/google-embedding.provider';
import { OpenAiEmbeddingProvider } from '../../apps/api/src/modules/embedding/infrastructure/openai-embedding.provider';
import { EmbeddingChunkRepository } from '../../apps/api/src/modules/embedding/infrastructure/embedding-chunk.repository';
import { type EmbeddingProvider } from '../../apps/api/src/modules/embedding/domain/embedding-provider.interface';
import { areEmbeddingProfilesCompatible, resolveEmbeddingProfile, resolveRuntimeEmbeddingProfileFromEnv } from '../../apps/api/src/modules/embedding/domain/embedding-profile-registry';
import { GraphRepository } from '../../apps/api/src/modules/graph/infrastructure/graph.repository';
import { PrismaService } from '../../apps/api/src/modules/prisma/prisma.service';
import { HybridRetrievalService } from '../../apps/api/src/modules/retrieval/application/hybrid-retrieval.service';
import { readJsonFile, resolveRepoPath } from '../io';
import { EvaluationPaths } from '../src/core/paths';
import { writeResult } from '../src/core/write-result';
import { readGroundTruthArtifactCoverage } from '../src/analysis/ground-truth-coverage';
import { writeErrorArtifact } from '../src/core/write-error-artifact';
import { summarizeEvidenceQuality } from '../src/analysis/evidence-quality';
import { readArtifactEvidenceExcerpt, readEmbeddingState, readSnapshotMetadata } from '../src/analysis/rag-export-db-read-model';


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
  const caseId = parseArg('--caseId');
  if (!caseId) {
    console.error('Usage: probe-vector-only.ts --caseId <id>');
    process.exit(1);
  }
  
  if (caseId !== 'reqimpact-case-006-squareboat-default-includes') {
    throw new Error('This probe strictly requires Case006. Passed: ' + caseId);
  }

  const runId = `vector-only-case006:${new Date().toISOString().replace(/[:.]/g, '-')}`;

  try {
    if (!process.env.DATABASE_URL) {
      throw new Error('E11A-1 vector probe REQUIRES database to be available. Failing fast.');
    }

    const alignmentPath = resolveRepoPath(EvaluationPaths.resultsV0.alignment + '/case-snapshot-alignment.v0.json');
    const alignment = readJsonFile<any>(alignmentPath);
    const caseAlign = alignment.cases.find((c: any) => c.caseId === caseId);

    if (!caseAlign || caseAlign.status !== 'ALIGNED_VECTOR_READY' || caseAlign.cleanRetrievalEligible !== true) {
      throw new Error(`Case006 must be ALIGNED_VECTOR_READY and cleanRetrievalEligible=true. Got: ${caseAlign?.status}`);
    }

    const { projectId, repositoryId, snapshotId } = caseAlign;

    const prisma = new PrismaService();
    await prisma.$connect();

    const snapshot = await readSnapshotMetadata({ prisma, snapshotId });
    if (!snapshot) throw new Error('Snapshot not found');

    const embeddingState = await readEmbeddingState({ prisma, snapshotId });
    const casesData = readJsonFile<any>(resolveRepoPath(EvaluationPaths.datasetV0.cases));
    const caseDef = casesData.cases.find((c: any) => c.id === caseId);

    const groundTruthFiles = caseDef.groundTruth.files;
    const groundTruthCoverage = await readGroundTruthArtifactCoverage({ prisma, snapshotId, groundTruthFiles });

    const { provider, model, providerName } = resolveRealQueryEmbeddingProvider();
    if (providerName === 'fake') throw new Error('Provider cannot be fake for real probe');

    const retrievalService = new HybridRetrievalService(
      new EmbeddingChunkRepository(prisma),
      provider,
      new ArtifactRepository(prisma),
      new GraphRepository(prisma),
      prisma,
    );

    const retrievedArtifacts = await retrievalService.retrieve({
      projectId,
      repositoryId,
      snapshotId,
      changeRequest: caseDef.requirementText,
      maxResults: 20,
      expandGraph: false,
      retrievalMode: 'VECTOR_ONLY'
    });

    const topK = [];
    let groundTruthHitAtK = false;
    for (const [index, retrieved] of retrievedArtifacts.entries()) {
      const excerpt = await readArtifactEvidenceExcerpt({ prisma, snapshotId, artifactId: retrieved.artifactId });
      const evidence = summarizeEvidenceQuality(excerpt);
      
      topK.push({
        rank: index + 1,
        filePath: retrieved.filePath,
        score: retrieved.score,
        finalScore: retrieved.score,
        vectorScore: retrieved.score,
        lexicalScore: 0,
        graphScore: 0,
        evidenceStatus: evidence.hasEvidence ? 'EVIDENCED' : 'NO_EVIDENCE',
        signals: retrieved.retrievalSignals
      });

      if (groundTruthFiles.includes(retrieved.filePath)) {
        groundTruthHitAtK = true;
      }
    }

      const docProfileId = embeddingState.embeddingProfileIds[0] || '';
      const docProfile = resolveEmbeddingProfile(docProfileId);
      const queryProfile = resolveRuntimeEmbeddingProfileFromEnv('QUERY');
      const profileCompatible = areEmbeddingProfilesCompatible(queryProfile, docProfile);

      const artifactJson = {
        runId,
        generatedAt: new Date().toISOString(),
        mode: 'VECTOR_ONLY_CASE_PROBE',
        caseId,
        scope: {
          type: 'SINGLE_CASE_PROBE',
          datasetVersion: 'v0',
          aggregateBenchmark: false
        },
        retrievalMode: 'VECTOR_ONLY',
        repo: caseDef.repo,
        requirementText: caseDef.requirementText,
        groundTruthFiles,
        embeddingState: {
          provider: providerName,
          model,
          queryDimensions: queryProfile.dimensions,
          documentDimensions: docProfile.dimensions,
          queryTaskType: 'RETRIEVAL_QUERY',
          documentTaskType: 'RETRIEVAL_DOCUMENT',
          queryEmbeddingProfileId: queryProfile.id,
          documentEmbeddingProfileId: docProfile.id,
          profileCompatible,
          alignmentVerified: true
        },
      groundTruthCoverage: {
        status: groundTruthCoverage.status,
        indexedGroundTruthFiles: groundTruthCoverage.indexedGroundTruthFiles,
        missingIndexedGroundTruthFiles: groundTruthCoverage.missingIndexedGroundTruthFiles
      },
      topK,
      groundTruthHitAtK,
      oracleCheck: {
        status: 'NOT_AVAILABLE',
        reason: 'Exact flat vector oracle is not implemented yet',
        requiredForAggregateBaseline: true
      },
      knownLimits: [
        'Single-case probe only, not an aggregate benchmark',
        'Changed files are proxy ground truth',
        'Vector-only result is path validation, not product ranking approval'
      ]
    };

    const markdownLines = [
      '# Vector-Only Case006 Probe',
      '',
      `Mode: VECTOR_ONLY_CASE_PROBE`,
      `Scope: Single-case only, not aggregate benchmark`,
      `Case: ${caseId}`,
      `Repo: ${caseDef.repo}`,
      `Ground truth: ${groundTruthFiles.join(', ')}`,
      '',
      '## Embedding Provenance',
      `Provider: ${artifactJson.embeddingState.provider}`,
      `Model: ${artifactJson.embeddingState.model}`,
      `Query dimensions: ${artifactJson.embeddingState.queryDimensions}`,
      `Document dimensions: ${artifactJson.embeddingState.documentDimensions}`,
      `Query task type: ${artifactJson.embeddingState.queryTaskType}`,
      `Document task type: ${artifactJson.embeddingState.documentTaskType}`,
      `Profile compatible: ${artifactJson.embeddingState.profileCompatible}`,
      '',
      '## Retrieval Result',
      '| Rank | FilePath | Final Score | Vector Score | Lexical | Graph | Evidence | Signals |',
      '| ---: | --- | ---: | ---: | ---: | ---: | --- | --- |',
      ...topK.map(k => `| ${k.rank} | ${k.filePath} | ${k.finalScore.toFixed(4)} | ${k.vectorScore.toFixed(4)} | ${k.lexicalScore} | ${k.graphScore} | ${k.evidenceStatus} | ${k.signals.join(', ')} |`),
      '',
      '## Ground Truth Hit',
      `groundTruthHitAtK: ${groundTruthHitAtK}`,
      '',
      '## Oracle Check',
      `status: ${artifactJson.oracleCheck.status}`,
      `reason: ${artifactJson.oracleCheck.reason}`,
      '',
      '## Known Limits',
      ...artifactJson.knownLimits.map(l => `- ${l}`)
    ];

    writeResult({
      runId,
      relativeArtifactPath: 'samples/vector-only/case006.v0.json',
      canonicalJsonPath: EvaluationPaths.resultsV0.samples.vectorOnly + '/case006.v0.json',
      canonicalMarkdownPath: EvaluationPaths.resultsV0.samples.vectorOnly + '/case006.v0.md',
      jsonData: artifactJson,
      markdownData: markdownLines.join('\n') + '\n'
    });

    updateManifest(runId);
    
    console.log(`Successfully completed VECTOR_ONLY_CASE_PROBE for ${caseId}`);
  } catch (err: any) {
    writeErrorArtifact({
      name: 'probe-vector-only-case006',
      runId,
      status: 'PIPELINE_ERROR',
      message: err.message || 'Unknown error',
      cause: err
    });
    console.error('[ERROR] probe-vector-only failed: ', err.message);
    process.exit(1);
  }
}

function updateManifest(runId: string) {
  const manifestPath = resolveRepoPath(EvaluationPaths.resultsV0.manifests + '/latest.manifest.json');
  const manifest = readJsonFile<any>(manifestPath);
  
  if (manifest.plannedArtifacts?.vectorOnlyCase006) {
    if (!manifest.canonicalArtifacts) manifest.canonicalArtifacts = {};
    manifest.canonicalArtifacts.vectorOnlyCase006 = manifest.plannedArtifacts.vectorOnlyCase006;
    delete manifest.plannedArtifacts.vectorOnlyCase006;
    manifest.latestRunId = runId;
    manifest.lastSuccessfulRunId = runId;
    
    // We import writeFileSync directly to avoid circular dependency loops if any
    const fs = require('fs');
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\\n', 'utf8');
  }
}

main();
