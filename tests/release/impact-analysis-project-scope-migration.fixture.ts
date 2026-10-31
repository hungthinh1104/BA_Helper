import type { Client } from 'pg';

const FOREIGN_ANALYSIS_ID = 'upgrade-analysis-cross-project';
const FOREIGN_REQUIREMENT_ID = 'upgrade-analysis-foreign-requirement';
const FOREIGN_REVISION_ID = 'upgrade-analysis-foreign-revision';
const FUTURE_FOREIGN_PROJECT_ID = 'upgrade-analysis-future-foreign-project';

export async function verifyLegacyImpactAnalysisProjectScope(client: Client): Promise<string[]> {
  const failures: string[] = [];
  const analysis = await client.query(`SELECT analysis."projectId", analysis."requirementId",
      repository."projectId" AS repository_project_id, requirement."projectId" AS requirement_project_id,
      revision."requirementId" AS revision_requirement_id
    FROM "ImpactAnalysis" AS analysis
    JOIN "Repository" AS repository ON repository.id = analysis."repositoryId"
    JOIN "Requirement" AS requirement ON requirement.id = analysis."requirementId"
    JOIN "RequirementRevision" AS revision ON revision.id = analysis."requirementRevisionId"
    WHERE analysis.id = 'upgrade-analysis'`);
  if (analysis.rowCount !== 1 || analysis.rows[0].projectId !== 'upgrade-project' ||
      analysis.rows[0].requirementId !== 'upgrade-requirement' ||
      analysis.rows[0].repository_project_id !== 'upgrade-project' ||
      analysis.rows[0].requirement_project_id !== 'upgrade-project' ||
      analysis.rows[0].revision_requirement_id !== 'upgrade-requirement') {
    failures.push('legacy analysis requirement/project identity was not backfilled from its revision and repository');
  }

  const constraints = await client.query(`SELECT conname, convalidated, confdeltype FROM pg_constraint
    WHERE conrelid = '"ImpactAnalysis"'::regclass
      AND conname IN (
        'ImpactAnalysis_repositoryId_projectId_fkey',
        'ImpactAnalysis_requirementId_projectId_fkey',
        'ImpactAnalysis_requirementRevisionId_requirementId_fkey'
      )`);
  if (constraints.rowCount !== 3 || constraints.rows.some((constraint) =>
    !constraint.convalidated || constraint.confdeltype !== 'r')) {
    failures.push('same-project ImpactAnalysis repository/requirement foreign keys are missing, unvalidated, or do not restrict provenance deletion');
  }

  await seedForeignRequirement(client);
  try {
    await client.query(`INSERT INTO "ImpactAnalysis"
      (id, "requirementRevisionId", "requirementId", "projectId", "repositoryId", "snapshotId", "sourceTargetId",
        "requestKey", status, stage, "updatedAt")
      VALUES ('upgrade-analysis-cross-project-future', $1, $2, 'upgrade-project', 'upgrade-repository',
        'upgrade-snapshot', 'upgrade-target', 'upgrade-analysis-cross-project-future-request', 'COMPLETED', 'DONE', now())`,
    [FOREIGN_REVISION_ID, FOREIGN_REQUIREMENT_ID]);
    failures.push('ImpactAnalysis accepted a requirement from another project');
  } catch (error) {
    const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : 'unknown';
    if (code !== '23503') throw new Error(`Expected cross-project analysis to fail with 23503, received ${code}.`);
  }
  const rejected = await client.query(`SELECT 1 FROM "ImpactAnalysis" WHERE id = 'upgrade-analysis-cross-project-future'`);
  if (rejected.rowCount !== 0) failures.push('rejected cross-project analysis was persisted');
  return failures;
}

export async function seedCrossProjectImpactAnalysisHistory(client: Client): Promise<void> {
  await client.query(`INSERT INTO "Project" (id, name, "updatedAt")
    VALUES ('upgrade-analysis-foreign-project', 'Foreign analysis project', now())`);
  await client.query(`INSERT INTO "Repository" (id, "projectId", "canonicalUrl", "updatedAt")
    VALUES ('upgrade-analysis-foreign-repository', 'upgrade-analysis-foreign-project',
      'https://github.com/example/foreign-analysis-project', now())`);
  await client.query(`INSERT INTO "RepositoryTarget"
    (id, "repositoryId", "targetKey", "requestedRef", "resolvedRefType", "latestObservedCommitSha", "lastObservedAt", "updatedAt")
    VALUES ('upgrade-analysis-foreign-target', 'upgrade-analysis-foreign-repository', 'branch:main', 'main',
      'BRANCH', 'foreign-analysis-project-commit', now(), now())`);
  await client.query(`INSERT INTO "RepositorySnapshot"
    (id, "repositoryId", "commitSha", "analyzerVersion", "coverageStatus", "updatedAt")
    VALUES ('upgrade-analysis-foreign-snapshot', 'upgrade-analysis-foreign-repository',
      'foreign-analysis-project-commit', 'analyzer@0.3.0', 'READY', now())`);
  await client.query(`INSERT INTO "ImpactAnalysis"
    (id, "requirementRevisionId", "snapshotId", "sourceTargetId", "requestKey", status, stage, "updatedAt")
    VALUES ($1, 'upgrade-revision', 'upgrade-analysis-foreign-snapshot', 'upgrade-analysis-foreign-target',
      'upgrade-analysis-invalid-project-history-request', 'COMPLETED', 'DONE', now())`, [FOREIGN_ANALYSIS_ID]);
}

export async function assertCrossProjectImpactAnalysisHistoryPreserved(client: Client): Promise<void> {
  const row = await client.query(`SELECT "requirementRevisionId", "snapshotId", "sourceTargetId"
    FROM "ImpactAnalysis" WHERE id = $1`, [FOREIGN_ANALYSIS_ID]);
  if (row.rowCount !== 1 || row.rows[0].requirementRevisionId !== 'upgrade-revision' ||
      row.rows[0].snapshotId !== 'upgrade-analysis-foreign-snapshot' ||
      row.rows[0].sourceTargetId !== 'upgrade-analysis-foreign-target') {
    throw new Error('Failed ImpactAnalysis project migration changed or deleted the historical cross-project row.');
  }

  const columns = await client.query(`SELECT column_name FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'ImpactAnalysis'
      AND column_name IN ('projectId', 'requirementId')`);
  if (columns.rowCount !== 0) throw new Error('Failed ImpactAnalysis project migration partially added identity columns.');

  const constraints = await client.query(`SELECT conname FROM pg_constraint
    WHERE conrelid = '"ImpactAnalysis"'::regclass
      AND conname IN ('ImpactAnalysis_requirementRevisionId_fkey',
        'ImpactAnalysis_repositoryId_projectId_fkey', 'ImpactAnalysis_requirementId_projectId_fkey',
        'ImpactAnalysis_requirementRevisionId_requirementId_fkey')`);
  const names = new Set(constraints.rows.map((constraint) => constraint.conname));
  if (!names.has('ImpactAnalysis_requirementRevisionId_fkey') ||
      names.has('ImpactAnalysis_repositoryId_projectId_fkey') ||
      names.has('ImpactAnalysis_requirementId_projectId_fkey') ||
      names.has('ImpactAnalysis_requirementRevisionId_requirementId_fkey')) {
    throw new Error('Failed ImpactAnalysis project migration partially replaced the original revision foreign key.');
  }
}

async function seedForeignRequirement(client: Client): Promise<void> {
  await client.query(`INSERT INTO "Project" (id, name, "updatedAt")
    VALUES ($1, 'Future foreign analysis project', now()) ON CONFLICT (id) DO NOTHING`, [FUTURE_FOREIGN_PROJECT_ID]);
  await client.query(`INSERT INTO "Requirement" (id, "projectId", "requestKey", "requestPayloadHash", "updatedAt")
    VALUES ($1, $2, 'upgrade-analysis-future-request', 'fixture', now()) ON CONFLICT (id) DO NOTHING`,
  [FOREIGN_REQUIREMENT_ID, FUTURE_FOREIGN_PROJECT_ID]);
  await client.query(`INSERT INTO "RequirementRevision"
    (id, "requirementId", title, "rawText", "normalizedText", "readinessStatus")
    VALUES ($1, $2, 'Foreign requirement', 'Foreign requirement', 'Foreign requirement', 'READY_FOR_ANALYSIS')
    ON CONFLICT (id) DO NOTHING`, [FOREIGN_REVISION_ID, FOREIGN_REQUIREMENT_ID]);
}
