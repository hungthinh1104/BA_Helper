export type VectorProviderSource =
  | 'persisted-db'
  | 'local-real'
  | 'network-real'
  | 'fake'
  | 'hash'
  | 'random'
  | 'keyword';

export type VectorBaselineProviderConfig = {
  providerName: string;
  embeddingModel: string;
  source: VectorProviderSource;
  allowsNetwork: boolean;
  isDeterministic: boolean;
  isFake: boolean;
  dbModeAvailable?: boolean;
  notes?: string;
};

const NETWORK_ALLOW_ENV = 'REQIMPACT_ALLOW_NETWORK_VECTOR_BASELINE';

function isTruthyEnv(value: string | undefined): boolean {
  return value === '1';
}

function normalizedProviderName(value: string): string {
  return value.trim().toLowerCase();
}

export function assertUsableVectorProvider(
  config: VectorBaselineProviderConfig,
): void {
  const providerName = normalizedProviderName(config.providerName);
  const embeddingModel = config.embeddingModel.trim();

  if (providerName.length === 0) {
    throw new Error('Vector provider rejected: providerName is required.');
  }

  if (providerName.includes('fake')) {
    throw new Error(
      'Vector provider rejected: fake providers must not produce vector benchmark results.',
    );
  }

  if (embeddingModel.length === 0) {
    throw new Error(
      'Vector provider rejected: embeddingModel is required for benchmark provenance.',
    );
  }

  if (config.isFake) {
    throw new Error(
      'Vector provider rejected: isFake=true is not allowed for vector baseline evaluation.',
    );
  }

  if (
    config.source === 'fake' ||
    config.source === 'hash' ||
    config.source === 'random' ||
    config.source === 'keyword'
  ) {
    throw new Error(
      `Vector provider rejected: source=${config.source} is not acceptable for vector benchmark results.`,
    );
  }

  if (config.source === 'persisted-db' && !config.dbModeAvailable) {
    throw new Error(
      'Vector provider rejected: persisted-db mode requires explicit DB availability.',
    );
  }

  if (config.allowsNetwork && !isTruthyEnv(process.env[NETWORK_ALLOW_ENV])) {
    throw new Error(
      `Vector provider rejected: network embedding use requires ${NETWORK_ALLOW_ENV}=1.`,
    );
  }

  if (config.source === 'network-real' && !config.allowsNetwork) {
    throw new Error(
      'Vector provider rejected: network-real source must declare allowsNetwork=true.',
    );
  }
}

export function getVectorBaselineRefusalMessage(
  error: unknown,
): string {
  return error instanceof Error
    ? error.message
    : 'Vector provider rejected: unknown configuration error.';
}
