export interface EmbeddingRequest {
  texts: string[];
  model?: string;
}

export interface EmbeddingResult {
  embeddings: number[][];
  model: string;
  dimensions: number;
  tokenUsage: number;
}

export abstract class EmbeddingProvider {
  abstract readonly providerName: string;
  abstract embed(request: EmbeddingRequest): Promise<EmbeddingResult>;
}
