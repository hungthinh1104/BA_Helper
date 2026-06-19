# Vector Baseline Path Probe v0

Generated at: 2026-06-17T11:50:42.989Z

Selected path: NONE

This is not a benchmark result.
No vector retrieval was executed.
No vector-baseline.v0.json was created.

## Feasible Paths

- None

## Blocked Paths

- PERSISTED_DB [BLOCKED]
  - Evidence: DATABASE_URL is not set.
  - Required next inputs: Set DATABASE_URL for read-only DB probing.
- LOCAL_MODEL [BLOCKED]
  - Evidence: No local vector provider environment is configured.
  - Required next inputs: REQIMPACT_VECTOR_PROVIDER=local, REQIMPACT_VECTOR_MODEL=<model-name>, REQIMPACT_VECTOR_SOURCE=local-model
- NETWORK_PROVIDER [BLOCKED]
  - Evidence: No network vector provider environment is configured.
  - Required next inputs: REQIMPACT_ALLOW_NETWORK_VECTOR_BASELINE=1, REQIMPACT_VECTOR_PROVIDER=<provider>, REQIMPACT_VECTOR_MODEL=<model>, REQIMPACT_VECTOR_SOURCE=network

## Environment

- hasDatabaseUrl: false
- vectorProvider: null
- vectorModel: null
- vectorSource: null
- networkVectorAllowed: false
- vectorBaselineResultExists: false

## Warnings

- This probe does not run vector retrieval.
- No vector-baseline.v0.json is produced.
