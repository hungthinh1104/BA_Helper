export type EmbeddingProfileProvider = 'fake' | 'google' | 'openai';

export type EmbeddingDistanceMetric = 'cosine';

export type EmbeddingProfile = {
  id: string;
  provider: EmbeddingProfileProvider;
  model: string;
  dimensions: number;
  outputDimensionality?: number;
  documentTaskType?: string;
  queryTaskType?: string;
  normalize: boolean;
  distanceMetric: EmbeddingDistanceMetric;
  maxInputTokens?: number;
  batchSize: number;
  maxConcurrency: number;
  isFake: boolean;
  benchmarkAllowed: boolean;
};
