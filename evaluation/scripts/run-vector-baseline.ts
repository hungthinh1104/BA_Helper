import { existsSync } from 'fs';
import { resolveRepoPath } from '../io';
import {
  assertUsableVectorProvider,
  getVectorBaselineRefusalMessage,
  type VectorBaselineProviderConfig,
} from '../src/vector-provider-gate';

function envOrEmpty(name: string): string {
  return (process.env[name] ?? '').trim();
}

function inferSource(raw: string): VectorBaselineProviderConfig['source'] {
  const normalized = raw.trim().toLowerCase();
  if (
    normalized === 'persisted-db' ||
    normalized === 'local-real' ||
    normalized === 'network-real' ||
    normalized === 'fake' ||
    normalized === 'hash' ||
    normalized === 'random' ||
    normalized === 'keyword'
  ) {
    return normalized;
  }
  return 'fake';
}

function loadProviderConfig(): VectorBaselineProviderConfig {
  const source = inferSource(envOrEmpty('REQIMPACT_VECTOR_PROVIDER_SOURCE'));
  const providerName = envOrEmpty('REQIMPACT_VECTOR_PROVIDER_NAME');
  const embeddingModel = envOrEmpty('REQIMPACT_VECTOR_PROVIDER_MODEL');
  const allowsNetwork = envOrEmpty('REQIMPACT_VECTOR_PROVIDER_NETWORK') === '1';
  const isFake = envOrEmpty('REQIMPACT_VECTOR_PROVIDER_FAKE') === '1';
  const dbModeAvailable =
    envOrEmpty('REQIMPACT_VECTOR_DB_MODE') === '1' &&
    envOrEmpty('DATABASE_URL').length > 0;

  return {
    providerName,
    embeddingModel,
    source,
    allowsNetwork,
    isDeterministic: envOrEmpty('REQIMPACT_VECTOR_PROVIDER_DETERMINISTIC') !== '0',
    isFake,
    dbModeAvailable,
    notes: 'Phase 2F gate only. This script refuses to emit vector-baseline.v0.json without a real provider.',
  };
}

export function runVectorBaselineGate(params?: {
  outputPath?: string;
  providerConfig?: VectorBaselineProviderConfig;
}): {
  refused: boolean;
  wroteOutput: boolean;
  message: string;
} {
  const outputPath =
    params?.outputPath ?? resolveRepoPath('evaluation/results/vector-baseline.v0.json');
  const providerConfig = params?.providerConfig ?? loadProviderConfig();
  try {
    assertUsableVectorProvider(providerConfig);
  } catch (error) {
    if (existsSync(outputPath)) {
      return {
        refused: true,
        wroteOutput: false,
        message: `Refusing vector baseline run while ${outputPath} already exists. Remove the file and rerun with a real provider.`,
      };
    }

    return {
      refused: true,
      wroteOutput: false,
      message: `${getVectorBaselineRefusalMessage(error)}\nNo vector-baseline.v0.json was written. Configure a real provider before running this benchmark.`,
    };
  }

  return {
    refused: false,
    wroteOutput: false,
    message:
      'Provider gate passed, but Phase 2F does not implement real vector scoring yet. No vector-baseline.v0.json was written.',
  };
}

function main(): void {
  const result = runVectorBaselineGate();
  console.log(result.message);
  if (result.refused && result.message.includes('already exists')) {
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}
