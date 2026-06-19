import { Injectable, Logger } from '@nestjs/common';
import { RetrievalRequest, RetrievedArtifact } from '../domain/retrieval.types';
import { buildRetrievalSuggestion } from '../domain/retrieval-suggestion';
import { EmbeddingChunkRepository } from '../../embedding/infrastructure/embedding-chunk.repository';
import { EmbeddingProvider } from '../../embedding/domain/embedding-provider.interface';
import { resolveSelectedEmbeddingProfile } from '../../embedding/embedding.module';
import {
  areEmbeddingProfilesCompatible,
  resolveEmbeddingProfile,
} from '../../embedding/domain/embedding-profile-registry';
import type { EmbeddingProfile } from '../../embedding/domain/embedding-profile';
import { ArtifactRepository } from '../../artifact/infrastructure/artifact.repository';
import { GraphRepository } from '../../graph/infrastructure/graph.repository';
import { PrismaService } from '../../prisma/prisma.service';
import { getDomainGlossary, matchDomainTerms, isDomainSupported } from '../../domain-profile';
import { Prisma } from '@prisma/client';
import { AiPolicy } from '../../ai/domain/ai.policy';

const WEIGHTS = {
  lexical: 0.45,
  vector: 0.35,
  graph: 0.15,
  kindBoost: 0.05,
} as const;

const MIN_VECTOR_SIMILARITY = 0.72;
const WEAK_VECTOR_THRESHOLD = 0.75;
const MAX_RETRIEVAL_RESULTS = 100;

type Candidate = {
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
  weakVectorSeed?: boolean;
};

@Injectable()
export class HybridRetrievalService {
  private readonly logger = new Logger(HybridRetrievalService.name);

  constructor(
    private readonly chunkRepo: EmbeddingChunkRepository,
    private readonly embeddingProvider: EmbeddingProvider,
    private readonly artifactRepo: ArtifactRepository,
    private readonly graphRepo: GraphRepository,
    private readonly prisma: PrismaService,
  ) {}

  async retrieve(request: RetrievalRequest): Promise<RetrievedArtifact[]> {
    const maxResults = this.normalizeLimit(request.maxResults ?? 20);
    // MVP: tenantId = projectId. Future: pass organizationId.
    const tenantId = request.tenantId ?? request.projectId;
    
    const snapshot = await this.prisma.repositorySnapshot.findUnique({
      where: { id: request.snapshotId },
      include: { profile: true },
    });
    const indexStatus = snapshot?.indexStatus ?? 'NOT_INDEXED';
    const profileDomain = snapshot?.profile?.domain;

    const candidates = new Map<string, Candidate>();

    const getCandidate = (id: string, artifact: any): Candidate => {
      let c = candidates.get(id);
      if (!c) {
        c = {
          artifact,
          lexicalScoreNorm: 0,
          graphScoreNorm: 0,
          vectorScoreNorm: 0,
          domainBoostNorm: 0,
          kindBoostNorm: 0,
          noisePenalty: 0,
          signals: new Set(),
          lexicalReasons: [],
          weakVectorSeed: false,
        };
        candidates.set(id, c);
      }
      return c;
    };

    // 1. Lexical search — domain-glossary-aware keyword extraction
    const { glossaryMatches, symbolMatches } = request.retrievalMode !== 'VECTOR_ONLY' 
      ? this.extractKeywords(request.changeRequest, profileDomain ?? request.domain)
      : { glossaryMatches: [], symbolMatches: [] };
    const keywords = [...glossaryMatches, ...symbolMatches];
    
    // Intent Detection
    const lowerReq = request.changeRequest.toLowerCase();
    const wantsApi = /(api|endpoint|controller|route|http)/i.test(lowerReq);
    const wantsService = /(business|logic|service|rule)/i.test(lowerReq);
    const wantsData = /(database|save|persist|data|model|schema|table)/i.test(lowerReq);
    const wantsTest = /(test|qa|regression|verify|spec)/i.test(lowerReq);
    
    const matchedIntentLabels: Array<'API' | 'SERVICE' | 'DATA' | 'TEST'> = [];
    if (wantsApi) matchedIntentLabels.push('API');
    if (wantsService) matchedIntentLabels.push('SERVICE');
    if (wantsData) matchedIntentLabels.push('DATA');
    if (wantsTest) matchedIntentLabels.push('TEST');
    
    if (keywords.length > 0) {
      const lexicalPatterns = keywords.map((keyword) => Prisma.sql`${`%${keyword}%`}`);
      const lexicalHits = await this.prisma.$queryRaw<any[]>(Prisma.sql`
        SELECT id, "artifactKey", "filePath", name AS "symbolName", "artifactType", "universal_kind" AS "universalKind"
        FROM "CodeArtifact"
        WHERE "snapshotId" = ${request.snapshotId}
          AND (
            "name"        ILIKE ANY(ARRAY[${Prisma.join(lexicalPatterns)}]::text[])
            OR "filePath"    ILIKE ANY(ARRAY[${Prisma.join(lexicalPatterns)}]::text[])
            OR "artifactKey" ILIKE ANY(ARRAY[${Prisma.join(lexicalPatterns)}]::text[])
          )
      `);

      for (const hit of lexicalHits) {
        const c = getCandidate(hit.id, hit);
        c.lexicalScoreNorm = 1.0;
        c.signals.add('LEXICAL');
        
        const hitLower = (hit.symbolName + ' ' + hit.filePath).toLowerCase();
        const requestLower = request.changeRequest.toLowerCase();
        
        let hasStrongDomain = false;
        let hasWeakDomain = false;
        
        for (const term of glossaryMatches) {
          const termLower = term.toLowerCase();
          if (hitLower.includes(termLower)) {
            if (requestLower.includes(termLower)) {
              hasStrongDomain = true;
            } else {
              hasWeakDomain = true;
            }
          }
        }
        
        if (hasStrongDomain) {
          c.domainBoostNorm = 1.0;
          c.signals.add('DOMAIN');
          c.lexicalReasons.push('strong domain match');
        } else if (hasWeakDomain) {
          c.domainBoostNorm = 0.5;
          c.signals.add('DOMAIN');
          c.lexicalReasons.push('weak domain match');
        } else {
          c.lexicalReasons.push('symbol match');
        }
      }
    }

    // 2. Vector semantic search
    if (indexStatus === 'VECTOR_READY') {
      try {
        const queryProfile = this.resolveQueryProfile(request);
        const artifactProfile = this.resolveArtifactProfile(request, queryProfile);
        const embeddingQueryRedaction = AiPolicy.redactPayload(request.changeRequest);

        if (!areEmbeddingProfilesCompatible(queryProfile, artifactProfile)) {
          this.logger.warn(
            `Vector search skipped due to incompatible embedding profiles: query=${queryProfile.id} artifact=${artifactProfile.id}`,
          );
        } else {
          const vectorResponse = await this.embeddingProvider.embed({
            texts: [embeddingQueryRedaction.redactedPayload],
            profile: queryProfile,
            inputRole: 'QUERY',
          });
          const queryEmbedding = vectorResponse.embeddings[0];

          const vectorHits = await this.chunkRepo.searchSimilar({
            tenantId,
            projectId: request.projectId,
            repositoryId: request.repositoryId,
            snapshotId: request.snapshotId,
            embeddingProfileId: artifactProfile.id,
            queryEmbedding,
            limit: this.normalizeLimit(maxResults * 2), // fetch more to allow dropping
          });

          for (const hit of vectorHits) {
            if (!hit.artifactId) continue;

            let artifact = candidates.get(hit.artifactId)?.artifact;
            if (!artifact) {
              artifact = await this.artifactRepo.findById(hit.artifactId);
              if (artifact) {
                 artifact.symbolName = artifact.name;
              }
            }

            if (!artifact) continue;

            const c = getCandidate(hit.artifactId, artifact);
            c.vectorScoreNorm = Math.max(c.vectorScoreNorm, hit.similarity);
            c.weakVectorSeed = c.vectorScoreNorm < MIN_VECTOR_SIMILARITY;
            c.signals.add('VECTOR');
          }
        }
      } catch (error) {
        this.logger.warn(`Vector search failed, falling back to lexical only: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    // 3. Graph expansion from current seed set
    if (request.expandGraph && request.retrievalMode !== 'VECTOR_ONLY') {
      const seedIds = Array.from(candidates.keys());
      if (seedIds.length > 0) {
        const expandedIds = await this.graphRepo.expandFromSeeds(request.snapshotId, seedIds);
        const newIds = expandedIds.filter(id => !candidates.has(id));

        if (newIds.length > 0) {
          const newArtifacts = await this.prisma.codeArtifact.findMany({
            where: { id: { in: newIds } },
          });

          for (const artifact of newArtifacts) {
            const c = getCandidate(artifact.id, { ...artifact, symbolName: artifact.name });
            c.graphScoreNorm = 0.7; // depth 1
            c.graphDepth = 1;
            c.signals.add('GRAPH');
          }
        }
        
        for (const id of seedIds) {
          const c = candidates.get(id)!;
          if (c.signals.has('LEXICAL') || c.signals.has('VECTOR')) {
            c.graphScoreNorm = 1.0; // root
            c.graphDepth = 0;
            // Root node acts as strong graph seed
            c.signals.add('GRAPH'); 
          }
        }
      }
    }

    // 4. Calculate final score, apply noise penalty, and filter
    const finalResults: RetrievedArtifact[] = [];
    const mentionsTest = request.changeRequest.toLowerCase().includes('test') || request.changeRequest.toLowerCase().includes('qa');
    
    for (const [id, c] of candidates.entries()) {
      const artifact = c.artifact;
      const artifactPath = artifact.filePath?.toLowerCase() || '';
      
      const isTest = artifact.artifactType === 'TEST' || artifactPath.includes('test') || artifactPath.includes('spec');
      const isNoisySupport = ['notification', 'audit', 'logger', 'recommendation', 'discount'].some(n => artifactPath.includes(n));
      const hasGraph = c.signals.has('GRAPH');
      const hasLexical = c.signals.has('LEXICAL');
      const hasVector = c.signals.has('VECTOR');
      
      const isWeakVector = hasVector && c.vectorScoreNorm < WEAK_VECTOR_THRESHOLD;
      const isTooWeakToKeep = hasVector && c.vectorScoreNorm < MIN_VECTOR_SIMILARITY;
      const isVectorOnly = hasVector && !hasLexical && !hasGraph;
      
      // Filter graph depth > 2
      if (c.graphDepth !== undefined && c.graphDepth > 2) {
         continue; 
      }
      
      // Drop vector-only low similarity candidate
      if (isVectorOnly && isTooWeakToKeep) {
         continue; 
      }

      if (c.weakVectorSeed && !hasLexical) {
         continue;
      }
      
      // Apply noise penalties
      if (isNoisySupport) {
         c.noisePenalty = 0.15;
      } else if (isWeakVector && isVectorOnly) {
         if (isTest && !mentionsTest) {
             c.noisePenalty = 0.05;
         } else {
             c.noisePenalty = 0.10;
         }
      }

      // Calculate kindBoostNorm
      const kind = artifact.universalKind;
      if (kind === 'API_ENDPOINT' && wantsApi) c.kindBoostNorm = 1.0;
      else if (kind === 'DOMAIN_SERVICE' && wantsService) c.kindBoostNorm = 1.0;
      else if (kind === 'DATA_MODEL' && wantsData) c.kindBoostNorm = 1.0;
      else if (kind === 'TEST_CASE' && wantsTest) c.kindBoostNorm = 1.0;

      if (c.kindBoostNorm > 0) {
        c.signals.add('KIND');
      }

      const finalScore = request.retrievalMode === 'VECTOR_ONLY'
        ? c.vectorScoreNorm
        : (c.lexicalScoreNorm * WEIGHTS.lexical) + 
          (c.graphScoreNorm * WEIGHTS.graph) + 
          (c.vectorScoreNorm * WEIGHTS.vector) + 
          (c.kindBoostNorm * WEIGHTS.kindBoost) - 
          c.noisePenalty;
        
      if (finalScore <= 0) continue;
      
      let method: 'LEXICAL' | 'VECTOR' | 'GRAPH_EXPANSION' | 'HYBRID' = 'HYBRID';
      if (c.signals.size === 1 || (c.signals.size === 2 && c.signals.has('DOMAIN'))) {
         if (c.signals.has('LEXICAL')) method = 'LEXICAL';
         if (c.signals.has('VECTOR')) method = 'VECTOR';
         if (c.signals.has('GRAPH')) method = 'GRAPH_EXPANSION';
      }
      
      const reasons: string[] = [];
      if (hasLexical) reasons.push(`lexical match (${Array.from(new Set(c.lexicalReasons)).join(', ')})`);
      if (hasVector) reasons.push(`semantic match (${c.vectorScoreNorm.toFixed(2)})`);
      if (hasGraph && c.graphDepth !== undefined && c.graphDepth > 0) reasons.push(`graph expansion (depth ${c.graphDepth})`);
      else if (hasGraph && c.graphDepth === 0) reasons.push('graph seed');
      
      const retrievedArtifact: RetrievedArtifact = {
        artifactId: artifact.id,
        artifactKey: artifact.artifactKey,
        filePath: artifact.filePath,
        symbolName: artifact.symbolName ?? artifact.name,
        artifactType: artifact.artifactType,
        score: finalScore,
        retrievalMethod: method,
        retrievalSignals: Array.from(c.signals),
        retrievalReason: reasons.join('; ') || 'unknown',
        strategyVersion: 'hybrid-retrieval-v1',
        lexicalScore: c.lexicalScoreNorm,
        graphScore: c.graphScoreNorm,
        vectorScore: c.vectorScoreNorm,
        domainBoost: c.domainBoostNorm,
        kindBoost: c.kindBoostNorm,
        finalScore: finalScore,
        retrievalDiagnostics: {
          version: 'retrieval-diagnostics@0.1.0',
          lexicalScoreNorm: c.lexicalScoreNorm,
          vectorScoreNorm: c.vectorScoreNorm,
          graphBoostNorm: c.graphScoreNorm,
          kindBoostNorm: c.kindBoostNorm,
          domainBoostNorm: c.domainBoostNorm,
          matchedIntentLabels,
          universalKind: artifact.universalKind ?? null,
          repositoryProfile: snapshot?.profile ? {
            domain: snapshot.profile.domain,
            framework: snapshot.profile.framework,
            language: snapshot.profile.language,
            domainProfileFallback: !isDomainSupported(snapshot.profile.domain ?? undefined),
          } : null,
          matchedDomainTerms: matchDomainTerms(
            request.changeRequest,
            profileDomain ?? request.domain,
          ).slice(0, 10),
          queryRedacted: AiPolicy.redactPayload(request.changeRequest).hasSecrets,
          finalScore,
        }
      };
      
      retrievedArtifact.suggestion = buildRetrievalSuggestion(retrievedArtifact);
      finalResults.push(retrievedArtifact);
    }

    finalResults.sort((a, b) => b.score - a.score);
    return finalResults.slice(0, maxResults);
  }

  private normalizeLimit(value: number): number {
    if (!Number.isFinite(value)) {
      return 20;
    }

    return Math.max(1, Math.min(Math.trunc(value), MAX_RETRIEVAL_RESULTS));
  }

  private resolveQueryProfile(request: RetrievalRequest): EmbeddingProfile {
    if (request.embeddingQueryProfileId) {
      return resolveEmbeddingProfile(request.embeddingQueryProfileId);
    }

    return resolveSelectedEmbeddingProfile('QUERY');
  }

  private resolveArtifactProfile(
    request: RetrievalRequest,
    queryProfile: EmbeddingProfile,
  ): EmbeddingProfile {
    if (request.embeddingArtifactProfileId) {
      return resolveEmbeddingProfile(request.embeddingArtifactProfileId);
    }

    return queryProfile;
  }

  private extractKeywords(text: string, domain?: string): { glossaryMatches: string[], symbolMatches: string[] } {
    // Pass domain as-is — getDomainGlossary handles unknown via UNKNOWN profile, no hard-code needed
    const glossary = getDomainGlossary(domain);
    const lowerText = text.toLowerCase();

    const glossaryMatches = glossary.filter(term => lowerText.includes(term.toLowerCase()));

    const symbolPattern = /\b([a-zA-Z][a-z]+(?:[A-Z][a-z]+)+|[a-z]+(?:_[a-z]+)+)\b/g;
    const symbolMatches: string[] = [];
    let match: RegExpExecArray | null;
    while ((match = symbolPattern.exec(text)) !== null) {
      symbolMatches.push(match[1]);
    }

    // Deduplicate symbol matches and keep only top 15 total
    const uniqueSymbols = Array.from(new Set(symbolMatches));
    return { 
      glossaryMatches: glossaryMatches.slice(0, 15), 
      symbolMatches: uniqueSymbols.slice(0, 15) 
    };
  }
}
