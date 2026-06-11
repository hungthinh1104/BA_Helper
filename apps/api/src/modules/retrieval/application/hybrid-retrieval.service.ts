import { Injectable } from '@nestjs/common';
import { RetrievalRequest, RetrievedArtifact } from '../domain/retrieval.types';
import { EmbeddingChunkRepository } from '../../embedding/infrastructure/embedding-chunk.repository';
import { EmbeddingProvider } from '../../embedding/domain/embedding-provider.interface';
import { ArtifactRepository } from '../../artifact/infrastructure/artifact.repository';
import { GraphRepository } from '../../graph/infrastructure/graph.repository';
import { PrismaService } from '../../prisma/prisma.service';
import { getDomainGlossary } from '../../domain-profile';

@Injectable()
export class HybridRetrievalService {
  constructor(
    private readonly chunkRepo: EmbeddingChunkRepository,
    private readonly embeddingProvider: EmbeddingProvider,
    private readonly artifactRepo: ArtifactRepository,
    private readonly graphRepo: GraphRepository,
    private readonly prisma: PrismaService,
  ) {}

  async retrieve(request: RetrievalRequest): Promise<RetrievedArtifact[]> {
    const maxResults = request.maxResults ?? 20;
    // MVP: tenantId = projectId. Future: pass organizationId.
    const tenantId = request.tenantId ?? request.projectId;
    const resultsMap = new Map<string, RetrievedArtifact>();

    // 1. Lexical search — domain-glossary-aware keyword extraction
    const keywords = this.extractKeywords(request.changeRequest, request.domain);
    if (keywords.length > 0) {
      const lexicalHits = await this.prisma.$queryRawUnsafe<any[]>(
        `SELECT id, "artifactKey", "filePath", name AS "symbolName", "artifactType"
         FROM "CodeArtifact"
         WHERE "snapshotId" = $1::uuid
           AND (
             "name"        ILIKE ANY($2)
             OR "filePath"    ILIKE ANY($2)
             OR "artifactKey" ILIKE ANY($2)
           )`,
        request.snapshotId,
        keywords.map(k => `%${k}%`),
      );

      for (const hit of lexicalHits) {
        resultsMap.set(hit.id, {
          artifactId: hit.id,
          artifactKey: hit.artifactKey,
          filePath: hit.filePath,
          symbolName: hit.symbolName,
          artifactType: hit.artifactType,
          score: 1.0,
          retrievalMethod: 'LEXICAL',
        });
      }
    }

    // 2. Vector semantic search
    try {
      const vectorResponse = await this.embeddingProvider.embed({
        texts: [request.changeRequest],
      });
      const queryEmbedding = vectorResponse.embeddings[0];

      const vectorHits = await this.chunkRepo.searchSimilar({
        tenantId,
        projectId: request.projectId,
        repositoryId: request.repositoryId,
        snapshotId: request.snapshotId,
        queryEmbedding,
        limit: maxResults,
      });

      for (const hit of vectorHits) {
        if (!hit.artifactId) continue;

        const existing = resultsMap.get(hit.artifactId);
        if (existing) {
          existing.retrievalMethod = 'HYBRID';
          existing.score = Math.max(existing.score, hit.similarity);
        } else {
          const artifact = await this.artifactRepo.findById(hit.artifactId);
          if (artifact) {
            resultsMap.set(hit.artifactId, {
              artifactId: artifact.id,
              artifactKey: artifact.artifactKey,
              filePath: artifact.filePath,
              symbolName: artifact.name,
              artifactType: artifact.artifactType,
              score: hit.similarity,
              retrievalMethod: 'VECTOR',
            });
          }
        }
      }
    } catch (error) {
      console.warn('Vector search failed, falling back to lexical only', error);
    }

    // 3. Graph expansion from current seed set
    if (request.expandGraph) {
      const seedIds = Array.from(resultsMap.keys());
      if (seedIds.length > 0) {
        const expandedIds = await this.graphRepo.expandFromSeeds(request.snapshotId, seedIds);
        const newIds = expandedIds.filter(id => !resultsMap.has(id));

        if (newIds.length > 0) {
          const newArtifacts = await this.prisma.codeArtifact.findMany({
            where: { id: { in: newIds } },
          });

          for (const artifact of newArtifacts) {
            resultsMap.set(artifact.id, {
              artifactId: artifact.id,
              artifactKey: artifact.artifactKey,
              filePath: artifact.filePath,
              symbolName: artifact.name,
              artifactType: artifact.artifactType,
              score: 0.5,
              retrievalMethod: 'GRAPH',
            });
          }
        }
      }
    }

    // 4. Rerank by score descending, cap at maxResults
    const finalResults = Array.from(resultsMap.values());
    finalResults.sort((a, b) => b.score - a.score);
    return finalResults.slice(0, maxResults);
  }

  /**
   * Extract keywords from the change request using domain glossary + symbol name heuristics.
   * Glossary drives lexical search; not injected into prompts.
   */
  private extractKeywords(text: string, domain?: string): string[] {
    const glossary = getDomainGlossary(domain ?? 'BOOKING');
    const lowerText = text.toLowerCase();

    // 1. Glossary terms that appear in the text
    const glossaryMatches = glossary.filter(term =>
      lowerText.includes(term.toLowerCase()),
    );

    // 2. CamelCase and snake_case symbol names from the text
    const symbolPattern = /\b([a-zA-Z][a-z]+(?:[A-Z][a-z]+)+|[a-z]+(?:_[a-z]+)+)\b/g;
    const symbolMatches: string[] = [];
    let match: RegExpExecArray | null;
    while ((match = symbolPattern.exec(text)) !== null) {
      symbolMatches.push(match[1]);
    }

    // 3. Union and deduplicate, limit to 15 terms to avoid over-broad queries
    const combined = Array.from(new Set([...glossaryMatches, ...symbolMatches]));
    return combined.slice(0, 15);
  }
}
