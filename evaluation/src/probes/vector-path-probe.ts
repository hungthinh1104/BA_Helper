import { EvaluationPaths } from '../core/paths';
import { existsSync } from 'fs';
import { resolveRepoPath } from '../../io';
import {
  assertUsableVectorProvider,
  getVectorBaselineRefusalMessage,
  type VectorBaselineProviderConfig,
} from '../core/vector-provider-gate';

export type VectorBaselinePath = 'PERSISTED_DB' | 'LOCAL_MODEL' | 'NETWORK_PROVIDER' | 'NONE';
export type ProbeStatus = 'FEASIBLE' | 'BLOCKED' | 'UNKNOWN';

export type VectorPathProbeEntry = {
  path: Exclude<VectorBaselinePath, 'NONE'>;
  status: ProbeStatus;
  evidence: string[];
  requiredNextInputs: string[];
};

export type VectorPathProbeReport = {
  runId: string;
  generatedAt: string;
  selectedPath: VectorBaselinePath;
  feasiblePaths: VectorPathProbeEntry[];
  blockedPaths: VectorPathProbeEntry[];
  environment: {
    hasDatabaseUrl: boolean;
    vectorProvider: string | null;
    vectorModel: string | null;
    vectorSource: string | null;
    networkVectorAllowed: boolean;
  };
  vectorBaselineResultExists: boolean;
  warnings: string[];
};

function envOrNull(name: string): string | null {
  const value = (process.env[name] ?? '').trim();
  return value.length === 0 ? null : value;
}

function buildProviderConfigFromEnv(): VectorBaselineProviderConfig {
  const providerName = envOrNull('REQIMPACT_VECTOR_PROVIDER') ?? '';
  const embeddingModel = envOrNull('REQIMPACT_VECTOR_MODEL') ?? '';
  const rawSource = (envOrNull('REQIMPACT_VECTOR_SOURCE') ?? '').toLowerCase();
  const source: VectorBaselineProviderConfig['source'] =
    rawSource === 'persisted-db'
      ? 'persisted-db'
      : rawSource === 'local-model'
        ? 'local-real'
        : rawSource === 'network'
          ? 'network-real'
          : rawSource === 'local-real' || rawSource === 'network-real'
            ? rawSource
            : rawSource === 'fake' || rawSource === 'hash' || rawSource === 'random' || rawSource === 'keyword'
              ? rawSource
              : 'fake';

  const hasDatabaseUrl = envOrNull('DATABASE_URL') !== null;

  return {
    providerName,
    embeddingModel,
    source,
    allowsNetwork: process.env.REQIMPACT_ALLOW_NETWORK_VECTOR_BASELINE === '1',
    isDeterministic: true,
    isFake:
      providerName.toLowerCase().includes('fake') ||
      source === 'fake',
    dbModeAvailable: hasDatabaseUrl,
    notes: 'Phase 3A probe only. No vector retrieval is executed.',
  };
}

function chooseSelectedPath(feasiblePaths: VectorPathProbeEntry[]): VectorBaselinePath {
  if (feasiblePaths.some((entry) => entry.path === 'PERSISTED_DB')) {
    return 'PERSISTED_DB';
  }
  if (feasiblePaths.some((entry) => entry.path === 'LOCAL_MODEL')) {
    return 'LOCAL_MODEL';
  }
  if (feasiblePaths.some((entry) => entry.path === 'NETWORK_PROVIDER')) {
    return 'NETWORK_PROVIDER';
  }
  return 'NONE';
}

export function probeVectorBaselinePath(params?: {
  generatedAt?: string;
  runId?: string;
  vectorBaselineResultPath?: string;
}): VectorPathProbeReport {
  const hasDatabaseUrl = envOrNull('DATABASE_URL') !== null;
  const vectorProvider = envOrNull('REQIMPACT_VECTOR_PROVIDER');
  const vectorModel = envOrNull('REQIMPACT_VECTOR_MODEL');
  const vectorSource = envOrNull('REQIMPACT_VECTOR_SOURCE');
  const networkVectorAllowed =
    process.env.REQIMPACT_ALLOW_NETWORK_VECTOR_BASELINE === '1';
  const vectorBaselineResultPath =
    params?.vectorBaselineResultPath ??
    resolveRepoPath(EvaluationPaths.resultsLegacy.baselines.vectorJson);
  const vectorBaselineResultExists = existsSync(vectorBaselineResultPath);

  const feasiblePaths: VectorPathProbeEntry[] = [];
  const blockedPaths: VectorPathProbeEntry[] = [];

  if (hasDatabaseUrl) {
    feasiblePaths.push({
      path: 'PERSISTED_DB',
      status: 'UNKNOWN',
      evidence: [
        'DATABASE_URL is present.',
        'DB path can be probed read-only, but this phase does not inspect EmbeddingChunk rows directly.',
      ],
      requiredNextInputs: [
        'projectId',
        'repositoryId',
        'snapshotId or a read-only snapshot listing command',
        'confirmation that EmbeddingChunk rows include embeddingModel, chunkerVersion, contentHash, and vector data',
      ],
    });
  } else {
    blockedPaths.push({
      path: 'PERSISTED_DB',
      status: 'BLOCKED',
      evidence: ['DATABASE_URL is not set.'],
      requiredNextInputs: ['Set DATABASE_URL for read-only DB probing.'],
    });
  }

  const providerConfig = buildProviderConfigFromEnv();
  const sourceKind = providerConfig.source;
  const localOrNetworkPath =
    sourceKind === 'network-real'
      ? 'NETWORK_PROVIDER'
      : sourceKind === 'local-real'
        ? 'LOCAL_MODEL'
        : null;

  if (localOrNetworkPath) {
    try {
      assertUsableVectorProvider(providerConfig);
      feasiblePaths.push({
        path: localOrNetworkPath,
        status: 'FEASIBLE',
        evidence: [
          `Provider gate accepted ${providerConfig.providerName || 'configured provider'}.`,
          `Embedding model: ${providerConfig.embeddingModel}.`,
        ],
        requiredNextInputs:
          localOrNetworkPath === 'LOCAL_MODEL'
            ? [
                'Implement or wire local real model inference outside this probe phase.',
              ]
            : [
                'Explicit network execution approval and an implementation that actually calls the provider.',
              ],
      });
    } catch (error) {
      blockedPaths.push({
        path: localOrNetworkPath,
        status: 'BLOCKED',
        evidence: [getVectorBaselineRefusalMessage(error)],
        requiredNextInputs:
          localOrNetworkPath === 'LOCAL_MODEL'
            ? [
                'Set REQIMPACT_VECTOR_PROVIDER, REQIMPACT_VECTOR_MODEL, and REQIMPACT_VECTOR_SOURCE=local-model with a real local model.',
              ]
            : [
                'Set REQIMPACT_ALLOW_NETWORK_VECTOR_BASELINE=1 and configure a documented real provider/model.',
              ],
      });
    }
  } else {
    blockedPaths.push({
      path: 'LOCAL_MODEL',
      status: 'BLOCKED',
      evidence: ['No local vector provider environment is configured.'],
      requiredNextInputs: [
        'REQIMPACT_VECTOR_PROVIDER=local',
        'REQIMPACT_VECTOR_MODEL=<model-name>',
        'REQIMPACT_VECTOR_SOURCE=local-model',
      ],
    });
    blockedPaths.push({
      path: 'NETWORK_PROVIDER',
      status: 'BLOCKED',
      evidence: ['No network vector provider environment is configured.'],
      requiredNextInputs: [
        'REQIMPACT_ALLOW_NETWORK_VECTOR_BASELINE=1',
        'REQIMPACT_VECTOR_PROVIDER=<provider>',
        'REQIMPACT_VECTOR_MODEL=<model>',
        'REQIMPACT_VECTOR_SOURCE=network',
      ],
    });
  }

  return {
    runId: params?.runId ?? 'vector-baseline-path-v0',
    generatedAt: params?.generatedAt ?? new Date().toISOString(),
    selectedPath: chooseSelectedPath(
      feasiblePaths.filter((entry) => entry.status === 'FEASIBLE'),
    ),
    feasiblePaths,
    blockedPaths,
    environment: {
      hasDatabaseUrl,
      vectorProvider,
      vectorModel,
      vectorSource,
      networkVectorAllowed,
    },
    vectorBaselineResultExists,
    warnings: [
      'This probe does not run vector retrieval.',
      'No vector-baseline.v0.json is produced.',
    ],
  };
}

export function renderVectorPathProbeMarkdown(
  report: VectorPathProbeReport,
): string {
  const lines = [
    '# Vector Baseline Path Probe v0',
    '',
    `Generated at: ${report.generatedAt}`,
    '',
    `Selected path: ${report.selectedPath}`,
    '',
    'This is not a benchmark result.',
    'No vector retrieval was executed.',
    'No vector-baseline.v0.json was created.',
    '',
    '## Feasible Paths',
    '',
  ];

  if (report.feasiblePaths.length === 0) {
    lines.push('- None');
  } else {
    for (const path of report.feasiblePaths) {
      lines.push(`- ${path.path} [${path.status}]`);
      lines.push(`  - Evidence: ${path.evidence.join(' ')}`);
      lines.push(
        `  - Required next inputs: ${path.requiredNextInputs.length === 0 ? 'None' : path.requiredNextInputs.join(', ')}`,
      );
    }
  }

  lines.push('', '## Blocked Paths', '');
  if (report.blockedPaths.length === 0) {
    lines.push('- None');
  } else {
    for (const path of report.blockedPaths) {
      lines.push(`- ${path.path} [${path.status}]`);
      lines.push(`  - Evidence: ${path.evidence.join(' ')}`);
      lines.push(
        `  - Required next inputs: ${path.requiredNextInputs.length === 0 ? 'None' : path.requiredNextInputs.join(', ')}`,
      );
    }
  }

  lines.push(
    '',
    '## Environment',
    '',
    `- hasDatabaseUrl: ${report.environment.hasDatabaseUrl}`,
    `- vectorProvider: ${report.environment.vectorProvider ?? 'null'}`,
    `- vectorModel: ${report.environment.vectorModel ?? 'null'}`,
    `- vectorSource: ${report.environment.vectorSource ?? 'null'}`,
    `- networkVectorAllowed: ${report.environment.networkVectorAllowed}`,
    `- vectorBaselineResultExists: ${report.vectorBaselineResultExists}`,
    '',
    '## Warnings',
    '',
  );

  for (const warning of report.warnings) {
    lines.push(`- ${warning}`);
  }

  return `${lines.join('\n')}\n`;
}
