import { PrismaService } from '../../apps/api/src/modules/prisma/prisma.service';

export type DbSnapshotReadinessStatus =
  | 'NO_DATABASE_URL'
  | 'DB_UNAVAILABLE'
  | 'READY_CANDIDATES_FOUND'
  | 'NO_READY_CANDIDATES'
  | 'UNKNOWN';

export type SnapshotReadinessClassification =
  | 'VECTOR_READY_CANDIDATE'
  | 'LEXICAL_ONLY_CANDIDATE'
  | 'NOT_READY'
  | 'UNKNOWN';

export type SnapshotUsableFor = 'VECTOR_BASELINE' | 'CURRENT_HYBRID_EXPORT';

export type SnapshotInspectionInput = {
  projectId: string | null;
  repositoryId: string | null;
  snapshotId: string | null;
  commitSha: string | null;
  indexStatus: string | null;
  chunkCount: number;
  embeddingModels: string[];
  chunkerVersions: string[];
};

export type DbSnapshotReadinessCandidate = {
  projectId: string;
  repositoryId: string;
  snapshotId: string;
  commitSha: string;
  indexStatus: string | null;
  chunkCount: number;
  embeddingModels: string[];
  chunkerVersions: string[];
  classification: SnapshotReadinessClassification;
  usableFor: SnapshotUsableFor[];
  warnings: string[];
};

export type DbSnapshotInspectionResult = {
  projectCount: number;
  repositoryCount: number;
  snapshots: SnapshotInspectionInput[];
};

export type DbSnapshotReadinessReport = {
  runId: string;
  generatedAt: string;
  status: DbSnapshotReadinessStatus;
  database: {
    hasDatabaseUrl: boolean;
    inspectedReadOnly: boolean;
    errorSummary?: string;
  };
  summary: {
    projectCount: number;
    repositoryCount: number;
    snapshotCount: number;
    vectorReadyCandidateCount: number;
    lexicalOnlyCandidateCount: number;
  };
  candidates: DbSnapshotReadinessCandidate[];
  nextInputsNeeded: string[];
  warnings: string[];
};

function normalizeDistinct(values: Array<string | null | undefined>): string[] {
  return Array.from(
    new Set(
      values
        .map((value) => (value ?? '').trim())
        .filter((value) => value.length > 0),
    ),
  ).sort();
}

function createUnknownCandidate(
  input: SnapshotInspectionInput,
  warnings: string[],
): DbSnapshotReadinessCandidate {
  return {
    projectId: input.projectId ?? 'UNKNOWN',
    repositoryId: input.repositoryId ?? 'UNKNOWN',
    snapshotId: input.snapshotId ?? 'UNKNOWN',
    commitSha: input.commitSha ?? 'UNKNOWN',
    indexStatus: input.indexStatus ?? null,
    chunkCount: input.chunkCount,
    embeddingModels: normalizeDistinct(input.embeddingModels),
    chunkerVersions: normalizeDistinct(input.chunkerVersions),
    classification: 'UNKNOWN',
    usableFor: [],
    warnings,
  };
}

export function classifySnapshotCandidate(
  input: SnapshotInspectionInput,
): DbSnapshotReadinessCandidate {
  const normalizedModels = normalizeDistinct(input.embeddingModels);
  const normalizedChunkerVersions = normalizeDistinct(input.chunkerVersions);
  const baseWarnings: string[] = [];

  if (!input.projectId || !input.repositoryId || !input.snapshotId || !input.commitSha) {
    return createUnknownCandidate(input, [
      'Safe snapshot identity fields are incomplete, so readiness cannot be classified confidently.',
    ]);
  }

  if (!input.indexStatus) {
    return createUnknownCandidate(input, [
      'Snapshot indexStatus could not be inspected safely.',
    ]);
  }

  if (input.indexStatus !== 'VECTOR_READY') {
    baseWarnings.push(
      `Snapshot indexStatus is ${input.indexStatus}; vector retrieval may be absent or incomplete.`,
    );
  }

  if (input.chunkCount <= 0) {
    return {
      projectId: input.projectId,
      repositoryId: input.repositoryId,
      snapshotId: input.snapshotId,
      commitSha: input.commitSha,
      indexStatus: input.indexStatus,
      chunkCount: 0,
      embeddingModels: normalizedModels,
      chunkerVersions: normalizedChunkerVersions,
      classification: 'LEXICAL_ONLY_CANDIDATE',
      usableFor: ['CURRENT_HYBRID_EXPORT'],
      warnings: [
        ...baseWarnings,
        'No EmbeddingChunk rows exist for this snapshot.',
      ],
    };
  }

  if (normalizedModels.length === 0 || normalizedChunkerVersions.length === 0) {
    return {
      projectId: input.projectId,
      repositoryId: input.repositoryId,
      snapshotId: input.snapshotId,
      commitSha: input.commitSha,
      indexStatus: input.indexStatus,
      chunkCount: input.chunkCount,
      embeddingModels: normalizedModels,
      chunkerVersions: normalizedChunkerVersions,
      classification: 'NOT_READY',
      usableFor: [],
      warnings: [
        ...baseWarnings,
        ...(normalizedModels.length === 0
          ? ['EmbeddingChunk rows exist but embeddingModel metadata is missing.']
          : []),
        ...(normalizedChunkerVersions.length === 0
          ? ['EmbeddingChunk rows exist but chunkerVersion metadata is missing.']
          : []),
      ],
    };
  }

  if (input.indexStatus === 'VECTOR_READY') {
    return {
      projectId: input.projectId,
      repositoryId: input.repositoryId,
      snapshotId: input.snapshotId,
      commitSha: input.commitSha,
      indexStatus: input.indexStatus,
      chunkCount: input.chunkCount,
      embeddingModels: normalizedModels,
      chunkerVersions: normalizedChunkerVersions,
      classification: 'VECTOR_READY_CANDIDATE',
      usableFor: ['VECTOR_BASELINE', 'CURRENT_HYBRID_EXPORT'],
      warnings: [],
    };
  }

  return {
    projectId: input.projectId,
    repositoryId: input.repositoryId,
    snapshotId: input.snapshotId,
    commitSha: input.commitSha,
    indexStatus: input.indexStatus,
    chunkCount: input.chunkCount,
    embeddingModels: normalizedModels,
    chunkerVersions: normalizedChunkerVersions,
    classification: 'NOT_READY',
    usableFor: ['CURRENT_HYBRID_EXPORT'],
    warnings: [
      ...baseWarnings,
      'Embedding rows exist, but the snapshot is not marked VECTOR_READY.',
    ],
  };
}

function buildNextInputsNeeded(
  candidates: DbSnapshotReadinessCandidate[],
  hasDatabaseUrl: boolean,
): string[] {
  if (!hasDatabaseUrl) {
    return [
      'Set DATABASE_URL and rerun evaluation/scripts/probe-db-snapshot-readiness.ts.',
    ];
  }

  const selectedCandidate =
    candidates.find((candidate) => candidate.classification === 'VECTOR_READY_CANDIDATE') ??
    candidates.find((candidate) => candidate.classification === 'LEXICAL_ONLY_CANDIDATE');

  if (!selectedCandidate) {
    return [
      'Create or publish a usable RepositorySnapshot locally, then rerun this probe.',
      'A ready candidate needs projectId, repositoryId, and snapshotId for future research commands.',
    ];
  }

  return [
    `--projectId ${selectedCandidate.projectId}`,
    `--repositoryId ${selectedCandidate.repositoryId}`,
    `--snapshotId ${selectedCandidate.snapshotId}`,
  ];
}

function deriveOverallStatus(
  candidates: DbSnapshotReadinessCandidate[],
  hasDatabaseUrl: boolean,
  inspectedReadOnly: boolean,
): DbSnapshotReadinessStatus {
  if (!hasDatabaseUrl) {
    return 'NO_DATABASE_URL';
  }

  if (!inspectedReadOnly) {
    return 'UNKNOWN';
  }

  if (candidates.some((candidate) => candidate.classification === 'VECTOR_READY_CANDIDATE')) {
    return 'READY_CANDIDATES_FOUND';
  }

  if (
    candidates.length > 0 &&
    candidates.every((candidate) => candidate.classification === 'UNKNOWN')
  ) {
    return 'UNKNOWN';
  }

  return 'NO_READY_CANDIDATES';
}

export function buildDbSnapshotReadinessReport(params: {
  hasDatabaseUrl: boolean;
  inspectedReadOnly: boolean;
  inspectionResult?: DbSnapshotInspectionResult;
  errorSummary?: string;
  generatedAt?: string;
  runId?: string;
}): DbSnapshotReadinessReport {
  const candidates = (params.inspectionResult?.snapshots ?? []).map(
    classifySnapshotCandidate,
  );
  const summary = {
    projectCount: params.inspectionResult?.projectCount ?? 0,
    repositoryCount: params.inspectionResult?.repositoryCount ?? 0,
    snapshotCount: params.inspectionResult?.snapshots.length ?? 0,
    vectorReadyCandidateCount: candidates.filter(
      (candidate) => candidate.classification === 'VECTOR_READY_CANDIDATE',
    ).length,
    lexicalOnlyCandidateCount: candidates.filter(
      (candidate) => candidate.classification === 'LEXICAL_ONLY_CANDIDATE',
    ).length,
  };

  return {
    runId: params.runId ?? 'db-snapshot-readiness-v0',
    generatedAt: params.generatedAt ?? new Date().toISOString(),
    status: params.errorSummary
      ? 'DB_UNAVAILABLE'
      : deriveOverallStatus(
          candidates,
          params.hasDatabaseUrl,
          params.inspectedReadOnly,
        ),
    database: {
      hasDatabaseUrl: params.hasDatabaseUrl,
      inspectedReadOnly: params.inspectedReadOnly,
      ...(params.errorSummary ? { errorSummary: params.errorSummary } : {}),
    },
    summary,
    candidates,
    nextInputsNeeded: buildNextInputsNeeded(candidates, params.hasDatabaseUrl),
    warnings: [
      'This probe does not run retrieval.',
      'This probe does not create vector-baseline.v0.json.',
    ],
  };
}

function summarizeError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

export async function inspectDbSnapshotStateReadOnly(): Promise<DbSnapshotInspectionResult> {
  const prisma = new PrismaService();
  await prisma.onModuleInit();

  try {
    const [projectCount, repositoryCount, snapshots, chunkRows] = await Promise.all([
      prisma.project.count(),
      prisma.repository.count(),
      prisma.repositorySnapshot.findMany({
        orderBy: [{ createdAt: 'desc' }],
        select: {
          id: true,
          repositoryId: true,
          commitSha: true,
          indexStatus: true,
          repository: {
            select: {
              projectId: true,
            },
          },
        },
      }),
      prisma.embeddingChunk.findMany({
        select: {
          snapshotId: true,
          embeddingModel: true,
          chunkerVersion: true,
        },
      }),
    ]);

    const chunkStateBySnapshot = new Map<
      string,
      {
        chunkCount: number;
        embeddingModels: string[];
        chunkerVersions: string[];
      }
    >();

    for (const row of chunkRows) {
      const current =
        chunkStateBySnapshot.get(row.snapshotId) ??
        {
          chunkCount: 0,
          embeddingModels: [],
          chunkerVersions: [],
        };

      current.chunkCount += 1;
      current.embeddingModels.push(row.embeddingModel);
      if (row.chunkerVersion) {
        current.chunkerVersions.push(row.chunkerVersion);
      }
      chunkStateBySnapshot.set(row.snapshotId, current);
    }

    return {
      projectCount,
      repositoryCount,
      snapshots: snapshots.map((snapshot) => {
        const chunkState = chunkStateBySnapshot.get(snapshot.id);
        return {
          projectId: snapshot.repository.projectId,
          repositoryId: snapshot.repositoryId,
          snapshotId: snapshot.id,
          commitSha: snapshot.commitSha,
          indexStatus: snapshot.indexStatus,
          chunkCount: chunkState?.chunkCount ?? 0,
          embeddingModels: normalizeDistinct(chunkState?.embeddingModels ?? []),
          chunkerVersions: normalizeDistinct(chunkState?.chunkerVersions ?? []),
        };
      }),
    };
  } finally {
    await prisma.onModuleDestroy();
  }
}

export async function probeDbSnapshotReadiness(params?: {
  databaseUrl?: string | null;
  inspectDb?: () => Promise<DbSnapshotInspectionResult>;
  generatedAt?: string;
  runId?: string;
}): Promise<DbSnapshotReadinessReport> {
  const databaseUrl = (params?.databaseUrl ?? process.env.DATABASE_URL ?? '').trim();
  if (databaseUrl.length === 0) {
    return buildDbSnapshotReadinessReport({
      hasDatabaseUrl: false,
      inspectedReadOnly: false,
      generatedAt: params?.generatedAt,
      runId: params?.runId,
    });
  }

  try {
    const inspectionResult = await (params?.inspectDb ?? inspectDbSnapshotStateReadOnly)();
    return buildDbSnapshotReadinessReport({
      hasDatabaseUrl: true,
      inspectedReadOnly: true,
      inspectionResult,
      generatedAt: params?.generatedAt,
      runId: params?.runId,
    });
  } catch (error) {
    return buildDbSnapshotReadinessReport({
      hasDatabaseUrl: true,
      inspectedReadOnly: false,
      errorSummary: summarizeError(error),
      generatedAt: params?.generatedAt,
      runId: params?.runId,
    });
  }
}

export function renderDbSnapshotReadinessMarkdown(params: {
  report: DbSnapshotReadinessReport;
  exampleCaseId?: string;
}): string {
  const { report } = params;
  const exampleCaseId = params.exampleCaseId ?? '<case-id>';
  const lines = [
    '# DB Snapshot Readiness v0',
    '',
    `Generated at: ${report.generatedAt}`,
    '',
    `Status: ${report.status}`,
    '',
    `DATABASE_URL present: ${report.database.hasDatabaseUrl ? 'yes' : 'no'}`,
    `DB inspected read-only: ${report.database.inspectedReadOnly ? 'yes' : 'no'}`,
    ...(report.database.errorSummary
      ? [`DB error summary: ${report.database.errorSummary}`]
      : []),
    '',
    'This is not a benchmark result.',
    'No retrieval was executed.',
    'No vector-baseline.v0.json was created.',
    '',
    '## Summary',
    '',
    `- Projects: ${report.summary.projectCount}`,
    `- Repositories: ${report.summary.repositoryCount}`,
    `- Snapshots: ${report.summary.snapshotCount}`,
    `- Vector-ready candidates: ${report.summary.vectorReadyCandidateCount}`,
    `- Lexical-only candidates: ${report.summary.lexicalOnlyCandidateCount}`,
    '',
    '## Candidates',
    '',
  ];

  if (report.candidates.length === 0) {
    lines.push('- None');
  } else {
    lines.push(
      '| Project | Repository | Snapshot | Commit | Index Status | Chunks | Models | Chunkers | Classification | Usable For | Warnings |',
      '| --- | --- | --- | --- | --- | ---: | --- | --- | --- | --- | --- |',
    );

    for (const candidate of report.candidates) {
      lines.push(
        `| ${candidate.projectId} | ${candidate.repositoryId} | ${candidate.snapshotId} | ${candidate.commitSha} | ${
          candidate.indexStatus ?? 'UNKNOWN'
        } | ${candidate.chunkCount} | ${
          candidate.embeddingModels.join(', ') || 'none'
        } | ${
          candidate.chunkerVersions.join(', ') || 'none'
        } | ${candidate.classification} | ${
          candidate.usableFor.join(', ') || 'none'
        } | ${candidate.warnings.join(' ; ') || 'none'} |`,
      );
    }
  }

  const selectedCandidate =
    report.candidates.find(
      (candidate) => candidate.classification === 'VECTOR_READY_CANDIDATE',
    ) ??
    report.candidates.find(
      (candidate) => candidate.classification === 'LEXICAL_ONLY_CANDIDATE',
    );

  lines.push('', '## Next Inputs Needed', '');
  for (const input of report.nextInputsNeeded) {
    lines.push(`- ${input}`);
  }

  lines.push('', '## Next Commands', '');
  if (!selectedCandidate) {
    lines.push('- No candidate snapshot is ready enough for a concrete next command yet.');
  } else {
    lines.push(
      '### CURRENT_HYBRID export',
      '',
      '```bash',
      `pnpm exec ts-node --project tsconfig.json evaluation/scripts/export-rag-samples.ts --caseId ${exampleCaseId} --projectId ${selectedCandidate.projectId} --repositoryId ${selectedCandidate.repositoryId} --snapshotId ${selectedCandidate.snapshotId}`,
      '```',
      '',
      '### Future persisted-vector baseline inputs',
      '',
      '```bash',
      `pnpm exec ts-node --project tsconfig.json evaluation/scripts/run-vector-baseline.ts --projectId ${selectedCandidate.projectId} --repositoryId ${selectedCandidate.repositoryId} --snapshotId ${selectedCandidate.snapshotId}`,
      '```',
    );
  }

  lines.push('', '## Warnings', '');
  for (const warning of report.warnings) {
    lines.push(`- ${warning}`);
  }

  return `${lines.join('\n')}\n`;
}
