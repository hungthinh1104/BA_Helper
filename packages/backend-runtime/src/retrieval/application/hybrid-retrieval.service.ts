import { Injectable, Logger } from '@nestjs/common';
import {
  RetrievalRequest,
  RetrievalResult,
  RetrievedArtifact,
} from '../domain/retrieval.types';
import { EmbeddingChunkRepository } from '../../embedding/infrastructure/embedding-chunk.repository';
import { EmbeddingProviderPort } from '@ba-helper/application';
import type { RetrievalVectorStatus } from '@ba-helper/application';
import { ArtifactRepository } from '../../artifact/infrastructure/artifact.repository';
import { GraphRepository } from '../../graph/infrastructure/graph.repository';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { DomainPackRegistry } from '../../domain-pack/application/domain-pack.registry';
import { RetrievalCandidate, rankRetrievalCandidates } from './retrieval-ranker';
import {
  MAX_RETRIEVAL_RESULTS,
  extractRetrievalKeywords,
  normalizeRetrievalLimit,
  resolveRetrievalTuning,
} from './retrieval-options';
import { AiPolicy, AppError } from '@ba-helper/shared';

@Injectable()
export class HybridRetrievalService {
  private readonly logger = new Logger(HybridRetrievalService.name);

  constructor(
    private readonly chunkRepo: EmbeddingChunkRepository,
    private readonly embeddingProvider: EmbeddingProviderPort,
    private readonly artifactRepo: ArtifactRepository,
    private readonly graphRepo: GraphRepository,
    private readonly prisma: PrismaService,
    private readonly domainPackRegistry: DomainPackRegistry,
  ) {}

  async retrieve(request: RetrievalRequest): Promise<RetrievalResult> {
    const tuning = resolveRetrievalTuning(request.tuning);
    const maxResults = normalizeRetrievalLimit(request.maxResults ?? 20);
    // MVP: tenantId = projectId. Future: pass organizationId.
    const tenantId = request.tenantId ?? request.projectId;
    
    const snapshot = await this.prisma.repositorySnapshot.findUnique({
      where: { id: request.snapshotId },
      include: { profile: true },
    });
    const indexStatus = snapshot?.indexStatus ?? 'NOT_INDEXED';
    const profileDomain = snapshot?.profile?.domain;
    const domainPackSelection = this.domainPackRegistry.selectPack({
      manualPackId: request.domain && request.domain !== 'UNKNOWN'
        ? request.domain
        : null,
      repositoryProfileDomain: profileDomain,
    });
    const domainPack = domainPackSelection.pack;

    const candidates = new Map<string, RetrievalCandidate>();
    let vectorStatus: RetrievalVectorStatus = 'NOT_READY';

    const getCandidate = (id: string, artifact: any): RetrievalCandidate => {
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
        };
        candidates.set(id, c);
      }
      return c;
    };

    // 1. Lexical search — domain-glossary-aware keyword extraction
    const { glossaryMatches, symbolMatches } = extractRetrievalKeywords(
      request.changeRequest,
      domainPack,
    );
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
      vectorStatus = 'FAILED';
      try {
        const embeddingQuery = AiPolicy.redactPayload(request.changeRequest).redactedPayload;
        const vectorResponse = await this.embeddingProvider.embed({
          texts: [embeddingQuery],
        });
        if (vectorResponse.model !== this.embeddingProvider.modelName) {
          vectorStatus = 'MODEL_MISMATCH';
          throw new AppError(
            'EMBEDDING_PROVIDER_FAILED',
            'Embedding provider returned a model that does not match its configured model identity',
          );
        }
        const queryEmbedding = vectorResponse.embeddings[0];

        const vectorHits = await this.chunkRepo.searchSimilar({
          tenantId,
          projectId: request.projectId,
          repositoryId: request.repositoryId,
          snapshotId: request.snapshotId,
          embeddingModel: vectorResponse.model,
          queryEmbedding,
          limit: normalizeRetrievalLimit(maxResults * 2), // fetch more to allow dropping
        });
        vectorStatus = vectorHits.length > 0 ? 'USED' : 'NO_COMPATIBLE_CHUNKS';

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
          c.signals.add('VECTOR');
        }
      } catch (error) {
        this.logger.warn(`Vector search failed, falling back to lexical only: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    // 3. Graph expansion from current seed set
    if (request.expandGraph) {
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

    const finalResults = rankRetrievalCandidates({
      candidates,
      request,
      tuning,
      domainPack,
      domainPackSelection,
      repositoryProfile: snapshot?.profile ? {
        domain: snapshot.profile.domain,
        framework: snapshot.profile.framework,
        language: snapshot.profile.language,
      } : null,
      matchedIntentLabels,
    });
    return {
      artifacts: this.applyAdaptiveCutoff(finalResults, maxResults, tuning.adaptiveTailGap),
      diagnostics: {
        strategy: vectorStatus === 'USED' ? 'hybrid' : 'lexical_fallback',
        vectorStatus,
      },
    };
  }

  /**
   * Rerank cutoff. A hard top-N slice can drop a borderline-but-critical artifact
   * ranked just outside N. With a positive tail gap, retain any next candidates
   * whose score is within `tailGap` of the last kept score (capped), keeping the
   * high-confidence tail. tailGap <= 0 preserves the plain top-N slice.
   */
  private applyAdaptiveCutoff(
    sorted: RetrievedArtifact[],
    maxResults: number,
    tailGap: number,
  ): RetrievedArtifact[] {
    if (tailGap <= 0 || sorted.length <= maxResults) {
      return sorted.slice(0, maxResults);
    }
    const threshold = sorted[maxResults - 1].score * (1 - tailGap);
    const hardCap = Math.min(sorted.length, MAX_RETRIEVAL_RESULTS);
    let end = maxResults;
    while (end < hardCap && sorted[end].score >= threshold) {
      end += 1;
    }
    return sorted.slice(0, end);
  }

}
