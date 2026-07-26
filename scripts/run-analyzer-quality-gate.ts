import { spawnSync } from 'node:child_process';

/**
 * Analyzer quality gate entry point.
 *
 * The gate runs the REAL runtime pipeline (scan → retrieval → impact-analysis
 * orchestration → deterministic fake AI) against pinned fixtures and enforces
 * two-layer recall/precision/evidence/negative-control/orphan floors. Because it
 * needs a live pgvector Postgres and the full Nest DI graph, it is implemented as
 * a Jest e2e spec that also writes `artifacts/evaluation/analyzer-scorecard.json`
 * (even on failure, so CI can always upload it).
 */
const result = spawnSync(
  'pnpm',
  [
    'exec',
    'jest',
    '--config',
    'jest.e2e.config.ts',
    '--runInBand',
    'tests/evaluation/analyzer-quality-gate.e2e-spec.ts',
  ],
  { stdio: 'inherit' },
);

process.exit(result.status ?? 1);
