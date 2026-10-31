import type { DomainPack } from '@ba-helper/contracts';
import { buildRetrievalSuggestion } from '../domain/retrieval-suggestion';
import type { RetrievalRequest, RetrievedArtifact, RetrievalTuning } from '../domain/retrieval.types';
import type { DomainPackSelectionResult } from '../../domain-pack/application/domain-pack.registry';
import { matchDomainPackTerms } from '../../domain-pack/application/domain-pack-terminology';

export type RetrievalCandidate = {
  artifact: any;
  lexicalScoreNorm: number;
  graphScoreNorm: number;
  vectorScoreNorm: number;
  domainBoostNorm: number;
  kindBoostNorm: number;
  noisePenalty: number;
  signals: Set<'LEXICAL' | 'GRAPH' | 'VECTOR' | 'DOMAIN' | 'KIND'>;
  graphDepth?: number;
  lexicalReasons: string[];
};

type IntentLabel = 'API' | 'SERVICE' | 'DATA' | 'TEST';

type RankRetrievalCandidatesInput = {
  candidates: Map<string, RetrievalCandidate>;
  request: RetrievalRequest;
  tuning: RetrievalTuning;
  domainPack: DomainPack;
  domainPackSelection: DomainPackSelectionResult;
  repositoryProfile: { domain: string; framework: string; language: string } | null;
  matchedIntentLabels: IntentLabel[];
};

export function rankRetrievalCandidates(input: RankRetrievalCandidatesInput): RetrievedArtifact[] {
  const { candidates, request, tuning, domainPack, domainPackSelection, repositoryProfile, matchedIntentLabels } = input;
  const finalResults: RetrievedArtifact[] = [];
  const mentionsTest = request.changeRequest.toLowerCase().includes('test') ||
    request.changeRequest.toLowerCase().includes('qa');
  const wantsApi = matchedIntentLabels.includes('API');
  const wantsService = matchedIntentLabels.includes('SERVICE');
  const wantsData = matchedIntentLabels.includes('DATA');
  const wantsTest = matchedIntentLabels.includes('TEST');

  for (const [, candidate] of candidates.entries()) {
    const artifact = candidate.artifact;
    const artifactPath = artifact.filePath?.toLowerCase() || '';
    const isTest = artifact.artifactType === 'TEST' || artifactPath.includes('test') || artifactPath.includes('spec');
    const isNoisySupport = ['notification', 'audit', 'logger', 'recommendation', 'discount']
      .some(value => artifactPath.includes(value));
    const hasGraph = candidate.signals.has('GRAPH');
    const hasLexical = candidate.signals.has('LEXICAL');
    const hasVector = candidate.signals.has('VECTOR');
    const isWeakVector = hasVector && candidate.vectorScoreNorm < tuning.weakVectorThreshold;
    const isTooWeakToKeep = hasVector && candidate.vectorScoreNorm < tuning.minVectorSimilarity;
    const isVectorOnly = hasVector && !hasLexical && !hasGraph;
    const keptWeakVectorOnly = isVectorOnly && isTooWeakToKeep && tuning.keepWeakVectorOnly;

    if (candidate.graphDepth !== undefined && candidate.graphDepth > 2) continue;
    if (isVectorOnly && isTooWeakToKeep && !tuning.keepWeakVectorOnly) continue;

    if (isNoisySupport) {
      candidate.noisePenalty = 0.15;
    } else if (keptWeakVectorOnly) {
      candidate.noisePenalty = 0.12;
    } else if (isWeakVector && isVectorOnly) {
      candidate.noisePenalty = isTest && !mentionsTest ? 0.05 : 0.10;
    }

    const kind = artifact.universalKind;
    if (kind === 'API_ENDPOINT' && wantsApi) candidate.kindBoostNorm = 1.0;
    else if (kind === 'DOMAIN_SERVICE' && wantsService) candidate.kindBoostNorm = 1.0;
    else if (kind === 'DATA_MODEL' && wantsData) candidate.kindBoostNorm = 1.0;
    else if (kind === 'TEST_CASE' && wantsTest) candidate.kindBoostNorm = 1.0;
    if (candidate.kindBoostNorm > 0) candidate.signals.add('KIND');

    const finalScore =
      (candidate.lexicalScoreNorm * tuning.weights.lexical) +
      (candidate.graphScoreNorm * tuning.weights.graph) +
      (candidate.vectorScoreNorm * tuning.weights.vector) +
      (candidate.kindBoostNorm * tuning.weights.kindBoost) - candidate.noisePenalty;
    if (finalScore <= 0) continue;

    const retrievalMethod = resolveRetrievalMethod(candidate.signals);
    const reasons: string[] = [];
    if (hasLexical) reasons.push(`lexical match (${Array.from(new Set(candidate.lexicalReasons)).join(', ')})`);
    if (hasVector) reasons.push(`semantic match (${candidate.vectorScoreNorm.toFixed(2)})`);
    if (hasGraph && candidate.graphDepth !== undefined && candidate.graphDepth > 0) {
      reasons.push(`graph expansion (depth ${candidate.graphDepth})`);
    } else if (hasGraph && candidate.graphDepth === 0) {
      reasons.push('graph seed');
    }

    const retrievedArtifact: RetrievedArtifact = {
      artifactId: artifact.id,
      artifactKey: artifact.artifactKey,
      filePath: artifact.filePath,
      symbolName: artifact.symbolName ?? artifact.name,
      artifactType: artifact.artifactType,
      score: finalScore,
      retrievalMethod,
      retrievalSignals: Array.from(candidate.signals),
      retrievalReason: reasons.join('; ') || 'unknown',
      strategyVersion: 'hybrid-retrieval-v1',
      lexicalScore: candidate.lexicalScoreNorm,
      graphScore: candidate.graphScoreNorm,
      vectorScore: candidate.vectorScoreNorm,
      domainBoost: candidate.domainBoostNorm,
      kindBoost: candidate.kindBoostNorm,
      finalScore,
      retrievalDiagnostics: {
        version: 'retrieval-diagnostics@0.1.0',
        lexicalScoreNorm: candidate.lexicalScoreNorm,
        vectorScoreNorm: candidate.vectorScoreNorm,
        graphBoostNorm: candidate.graphScoreNorm,
        kindBoostNorm: candidate.kindBoostNorm,
        domainBoostNorm: candidate.domainBoostNorm,
        matchedIntentLabels,
        universalKind: artifact.universalKind ?? null,
        repositoryProfile: repositoryProfile ? {
          ...repositoryProfile,
          domainPackFallback: domainPack.status === 'FALLBACK',
        } : null,
        matchedDomainTerms: matchDomainPackTerms(request.changeRequest, domainPack).slice(0, 10),
        domainPack: {
          id: domainPack.id,
          version: domainPack.version,
          status: domainPack.status,
          selectedBy: domainPackSelection.selectedBy,
        },
        finalScore,
      },
    };
    retrievedArtifact.suggestion = buildRetrievalSuggestion(retrievedArtifact);
    finalResults.push(retrievedArtifact);
  }

  return finalResults.sort((left, right) => right.score - left.score);
}

function resolveRetrievalMethod(signals: RetrievalCandidate['signals']): RetrievedArtifact['retrievalMethod'] {
  if (signals.size === 1 || (signals.size === 2 && signals.has('DOMAIN'))) {
    if (signals.has('LEXICAL')) return 'LEXICAL';
    if (signals.has('VECTOR')) return 'VECTOR';
    if (signals.has('GRAPH')) return 'GRAPH_EXPANSION';
  }
  return 'HYBRID';
}
