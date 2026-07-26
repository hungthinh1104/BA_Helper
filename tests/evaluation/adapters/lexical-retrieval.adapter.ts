import * as path from 'node:path';
import { EvaluationAdapter } from '../evaluation-runner';
import { EvaluationCase, NormalizedEvaluationResult } from '../evaluation-types';
import { SafeFileEnumerator } from '../../../packages/analyzer/src/scanner/core/safe-file-enumerator';
import { scanProject } from '../../../packages/analyzer/src/scanner/scanner';
import { buildGraph } from '../../../packages/analyzer/src/graph/graph';
import type { ScanArtifact } from '../../../packages/analyzer/src/scanner/scanner.types';

export class LexicalRetrievalEvaluationAdapter implements EvaluationAdapter {
  private readonly fixtureRoot = path.join(process.cwd(), 'tests/fixtures');

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

    const artifacts = scanResult.artifacts;

    // 2. Tokenize Query
    const queryTokens = this.tokenize(`${evalCase.requirementTitle} ${evalCase.requirementText}`);

    // 3. Score Artifacts
    type ScoredArtifact = {
      artifact: ScanArtifact;
      score: number;
      universalKind: string;
    };

    const scoredArtifacts: ScoredArtifact[] = artifacts.map(artifact => {
      const universalKind = this.mapTypeToUniversalKind(artifact.type, artifact.filePath);

      const artifactTokens = new Set([
        ...this.tokenize(artifact.stableId),
        ...this.tokenize(artifact.symbolName || ''),
        ...this.tokenize(artifact.filePath || ''),
        ...this.tokenize(artifact.type || ''),
        ...this.tokenize(universalKind),
        ...this.tokenize(artifact.excerpt || '').slice(0, 50),
      ]);

      let score = 0;
      for (const qt of queryTokens) {
        if (artifactTokens.has(qt)) {
          score += 1;
        }
      }

      // Exact intent boost
      const reqLower = (evalCase.requirementTitle + ' ' + evalCase.requirementText).toLowerCase();
      if (reqLower.includes('api') && universalKind === 'API_ENDPOINT') score += 2;
      if (reqLower.includes('webhook') && universalKind === 'API_ENDPOINT') score += 2;
      if (reqLower.includes('service') && universalKind === 'DOMAIN_SERVICE') score += 2;
      if ((reqLower.includes('test') || reqLower.includes('qa')) && universalKind === 'TEST_CASE') score += 2;

      return { artifact, score, universalKind };
    });

    // 4. Sort and Tie-break
    scoredArtifacts.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (a.universalKind !== b.universalKind) {
         return a.universalKind.localeCompare(b.universalKind);
      }
      if (a.artifact.filePath !== b.artifact.filePath) {
         return (a.artifact.filePath || '').localeCompare(b.artifact.filePath || '');
      }
      if (a.artifact.symbolName !== b.artifact.symbolName) {
         return (a.artifact.symbolName || '').localeCompare(b.artifact.symbolName || '');
      }
      return a.artifact.stableId.localeCompare(b.artifact.stableId);
    });

    // 5. Top N
    const topN = 20;
    const connectedArtifactKeys = new Set(
      buildGraph(scanResult).edges.flatMap((edge) => [edge.from, edge.to]),
    );
    const results = scoredArtifacts
      .filter((scored) => scored.score > 0)
      .filter(
        (scored) =>
          scored.universalKind !== 'DOMAIN_SERVICE' ||
          connectedArtifactKeys.has(scored.artifact.stableId),
      )
      .slice(0, topN);

    // 6. Map to Normalized Result
    const evidenceByArtifactKey: Record<string, string[]> = {};
    for (const res of results) {
       if (res.artifact.excerpt) {
          // Bounded excerpt
          evidenceByArtifactKey[res.artifact.stableId] = [res.artifact.excerpt.substring(0, 500)];
       }
    }

    return {
      foundImpactedArtifactKeys: results.map(r => r.artifact.stableId),
      evidenceByArtifactKey,
      unknownsOrQuestions: [], // Retrieval does not generate
      risks: [],               // Retrieval does not generate
      qaScenarios: [],         // Retrieval does not generate
    };
  }

  private tokenize(text: string): string[] {
    const uncamelled = text.replace(/([a-z])([A-Z])/g, '$1 $2');
    const separated = uncamelled.replace(/[-_/\.]/g, ' ');
    const cleaned = separated.toLowerCase().replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim();
    
    // Stop words
    const stops = new Set(['the', 'and', 'for', 'that', 'this', 'with', 'from', 'a', 'an']);
    return Array.from(new Set(cleaned.split(' ').filter(t => t.length > 2 && !stops.has(t))));
  }

  private mapTypeToUniversalKind(type: string, filePath: string): string {
    const t = type.toUpperCase();
    if (t.includes('API') || t.includes('CONTROLLER')) return 'API_ENDPOINT';
    if (t.includes('SERVICE')) return 'DOMAIN_SERVICE';
    if (t.includes('ENTITY') || t.includes('REPOSITORY') || t.includes('DATA_MODEL')) return 'DATA_MODEL';
    if (t.includes('TEST') || filePath.toLowerCase().includes('.spec.') || filePath.toLowerCase().includes('.test.')) return 'TEST_CASE';
    return 'UNKNOWN';
  }
}
