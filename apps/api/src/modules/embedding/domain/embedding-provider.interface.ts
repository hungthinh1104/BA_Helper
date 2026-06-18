import type { EmbeddingProfile } from './embedding-profile';

export type EmbeddingInputRole = 'DOCUMENT' | 'QUERY';

export interface EmbeddingRequest {
  texts: string[];
  profile: EmbeddingProfile;
  inputRole: EmbeddingInputRole;
}

export interface EmbeddingResult {
  embeddings: number[][];
  provider: string;
  model: string;
  dimensions: number;
  profileId: string;
  configHash: string;
  normalized: boolean;
  tokenUsage?: number | null;
}

export abstract class EmbeddingProvider {
  abstract readonly providerName: string;
  abstract readonly profile: EmbeddingProfile;
  abstract embed(request: EmbeddingRequest): Promise<EmbeddingResult>;
}
