import * as path from 'node:path';
import * as crypto from 'crypto';
import { EvaluationAdapter } from '../evaluation-runner';
import { EvaluationCase, NormalizedEvaluationResult } from '../evaluation-types';
import { SafeFileEnumerator } from '../../../packages/analyzer/src/scanner/safe-file-enumerator';
import { scanProject } from '../../../packages/analyzer/src/scanner/scanner';
import { PrismaService } from '../../../apps/api/src/modules/prisma/prisma.service';
import { HybridRetrievalService } from '../../../apps/api/src/modules/retrieval/application/hybrid-retrieval.service';

export class HybridRetrievalEvaluationAdapter implements EvaluationAdapter {
  private readonly fixtureRoot = path.join(process.cwd(), 'tests/fixtures');

  constructor(
    private readonly prisma: PrismaService,
    private readonly hybridRetrievalService: HybridRetrievalService,
  ) {}

  async evaluateCase(evalCase: EvaluationCase): Promise<NormalizedEvaluationResult> {
    const fixturePath = path.join(this.fixtureRoot, evalCase.targetFixture);

    // 1. Enumerate & Scan
    const enumerator = new SafeFileEnumerator(fixturePath);
    const enumResult = await enumerator.enumerate();

    const scanCoverage = {
      status: enumResult.isPartial ? 'PARTIAL' : 'FULL',
      skippedFiles: enumResult.skippedFiles,
      skippedSummary: enumResult.skippedSummary,
      limits: enumResult.limits,
      limitHits: enumResult.limitHits,
    } as const;

    const scanResult = scanProject({
      fixturePath,
      tsFiles: enumResult.tsFiles,
      coverage: scanCoverage,
    });

    const projectId = crypto.randomUUID();
    const repositoryId = crypto.randomUUID();
    const snapshotId = crypto.randomUUID();

    // 2. Persist to DB for isolated test
    await this.prisma.project.create({
      data: { id: projectId, name: `Smoke Project ${evalCase.id}` },
    });

    await this.prisma.repository.create({
      data: {
        id: repositoryId,
        projectId,
        canonicalUrl: `https://fake.github.com/${evalCase.targetFixture}`,
      },
    });

    await this.prisma.repositorySnapshot.create({
      data: {
        id: snapshotId,
        repositoryId,
        commitSha: `commit-${crypto.randomUUID()}`,
        analyzerVersion: 'smoke-eval-v1',
        coverageStatus: 'READY',
        indexStatus: 'VECTOR_READY', // We pretend vector is ready to force searchSimilar call
      },
    });

    const dbArtifacts = scanResult.artifacts.map(a => ({
      id: crypto.randomUUID(),
      snapshotId,
      artifactKey: a.stableId,
      name: a.symbolName || a.stableId,
      artifactType: a.type,
      filePath: a.filePath,
      startLine: a.startLine,
      endLine: a.endLine,
      universalKind: a.type.includes('API') || a.type.includes('CONTROLLER') ? 'API_ENDPOINT' :
                     a.type.includes('SERVICE') ? 'DOMAIN_SERVICE' :
                     a.type.includes('ENTITY') ? 'DATA_MODEL' : 'UNKNOWN'
    }));

    // Chunk size inserts to avoid parameter limits if fixture is large
    for (const artifact of dbArtifacts) {
      await this.prisma.codeArtifact.create({ data: artifact });
    }

    // 3. Run Real Hybrid Retrieval
    // Note: chunkRepo.searchSimilar is expected to be mocked by the spec file
    // to prevent real external embedding calls but still provide deterministic fake semantic hits.
    const results = await this.hybridRetrievalService.retrieve({
      projectId,
      repositoryId,
      snapshotId,
      changeRequest: `${evalCase.requirementTitle} ${evalCase.requirementText}`,
      domain: evalCase.domain?.packId ?? 'general', // Use the domain from the fixture context or fallback to general
      maxResults: 20,
      expandGraph: false, // Turn off graph expansion for pure retrieval testing unless needed
    });

    // 4. Map to Normalized Result
    const evidenceByArtifactKey: Record<string, string[]> = {};
    for (const res of results) {
      // Find original scan artifact to extract evidence snippet
      const scanArtifact = scanResult.artifacts.find(a => a.stableId === res.artifactKey);
      if (scanArtifact && scanArtifact.excerpt) {
        evidenceByArtifactKey[res.artifactKey] = [scanArtifact.excerpt.substring(0, 500)];
      }
    }

    return {
      foundImpactedArtifactKeys: results.map(r => r.artifactKey),
      evidenceByArtifactKey,
      unknownsOrQuestions: [], // Retrieval does not generate these
      risks: [],
      qaScenarios: [],
    };
  }
}
