import type { Client } from 'pg';

const VALID_RUN_ID = 'upgrade-multi-repo-run';
const FOREIGN_PROJECT_ID = 'upgrade-foreign-project';
const FOREIGN_REQUIREMENT_ID = 'upgrade-foreign-requirement';
const FOREIGN_REVISION_ID = 'upgrade-foreign-revision';

export async function seedLegacyMultiRepoRun(client: Client, createdByUserId: string): Promise<void> {
  await client.query(`INSERT INTO "MultiRepoAnalysisRun"
    (id, "projectId", "requirementRevisionId", "createdByUserId", "requestKey", "updatedAt")
    VALUES ($1, 'upgrade-project', 'upgrade-revision', $2, 'upgrade-multi-repo-request', now())`,
  [VALID_RUN_ID, createdByUserId]);
}

export async function seedLegacyMultiRepoChildAnalysis(client: Client): Promise<void> {
  const result = await client.query(`UPDATE "ImpactAnalysis" SET "multiRepoRunId" = $1 WHERE id = 'upgrade-analysis'`, [VALID_RUN_ID]);
  if (result.rowCount !== 1) throw new Error('Expected a legacy ImpactAnalysis row to attach to the valid multi-repo run.');
}

export async function verifyLegacyMultiRepoRun(client: Client, createdByUserId: string): Promise<string[]> {
  const failures: string[] = [];
  const run = await client.query(`SELECT run."projectId", run."requirementId",
      run."requirementRevisionId", requirement."projectId" AS revision_project_id
    FROM "MultiRepoAnalysisRun" AS run
    JOIN "RequirementRevision" AS revision ON revision."id" = run."requirementRevisionId"
    JOIN "Requirement" AS requirement ON requirement."id" = revision."requirementId"
    WHERE run."id" = $1`, [VALID_RUN_ID]);
  if (run.rowCount !== 1 ||
      run.rows[0].projectId !== 'upgrade-project' ||
      run.rows[0].requirementId !== 'upgrade-requirement' ||
      run.rows[0].requirementRevisionId !== 'upgrade-revision' ||
      run.rows[0].revision_project_id !== run.rows[0].projectId) {
    failures.push('legacy multi-repo run was not preserved and backfilled with its owning requirement');
  }

  const constraints = await client.query(`SELECT conname, convalidated
    FROM pg_constraint
    WHERE conrelid = '"MultiRepoAnalysisRun"'::regclass
      AND conname IN (
        'MultiRepoAnalysisRun_requirementId_projectId_fkey',
        'MultiRepoAnalysisRun_requirementRevisionId_requirementId_fkey'
      )`);
  if (constraints.rowCount !== 2 || constraints.rows.some((constraint) => !constraint.convalidated)) {
    failures.push('multi-repo requirement/project foreign keys are missing or unvalidated');
  }

  await client.query(`INSERT INTO "Project" (id, name, "updatedAt")
    VALUES ($1, 'Foreign project', now())`, [FOREIGN_PROJECT_ID]);
  await client.query(`INSERT INTO "Requirement"
    (id, "projectId", "requestKey", "requestPayloadHash", "updatedAt")
    VALUES ($1, $2, 'upgrade-foreign-requirement-request', '', now())`,
  [FOREIGN_REQUIREMENT_ID, FOREIGN_PROJECT_ID]);
  await client.query(`INSERT INTO "RequirementRevision"
    (id, "requirementId", title, "rawText", "normalizedText", "readinessStatus")
    VALUES ($1, $2, 'Foreign requirement', 'Text', 'Text', 'READY_FOR_ANALYSIS')`,
  [FOREIGN_REVISION_ID, FOREIGN_REQUIREMENT_ID]);

  for (const [id, requirementId, requestKey] of [
    ['upgrade-cross-project-run', FOREIGN_REQUIREMENT_ID, 'upgrade-cross-project-request'],
    ['upgrade-cross-revision-run', 'upgrade-requirement', 'upgrade-cross-revision-request'],
  ]) {
    try {
      await client.query(`INSERT INTO "MultiRepoAnalysisRun"
        (id, "projectId", "requirementId", "requirementRevisionId", "createdByUserId", "requestKey", "updatedAt")
        VALUES ($1, 'upgrade-project', $2, $3, $4, $5, now())`,
      [id, requirementId, FOREIGN_REVISION_ID,
        createdByUserId, requestKey]);
      failures.push(`multi-repo run accepted mismatched project/revision identity: ${id}`);
    } catch (error) {
      const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : 'unknown';
      if (code !== '23503') {
        throw new Error(`Expected multi-repo lineage mismatch to fail with 23503, received ${code}.`);
      }
    }
  }

  const lineageConstraint = await client.query(`SELECT convalidated, confdeltype FROM pg_constraint
    WHERE conrelid = '"ImpactAnalysis"'::regclass
      AND conname = 'ImpactAnalysis_multiRepoRunId_projectId_requirementId_requirementRevisionId_fkey'`);
  if (lineageConstraint.rowCount !== 1 || !lineageConstraint.rows[0].convalidated ||
      lineageConstraint.rows[0].confdeltype !== 'r') {
    failures.push('multi-repo child project/requirement/revision foreign key is missing, unvalidated, or does not restrict deletion');
  }
  const child = await client.query(`SELECT analysis."multiRepoRunId", analysis."projectId",
      analysis."requirementId", analysis."requirementRevisionId", run."projectId" AS run_project_id,
      run."requirementId" AS run_requirement_id, run."requirementRevisionId" AS run_revision_id
    FROM "ImpactAnalysis" AS analysis
    JOIN "MultiRepoAnalysisRun" AS run ON run.id = analysis."multiRepoRunId"
    WHERE analysis.id = 'upgrade-analysis'`);
  if (child.rowCount !== 1 || child.rows[0].multiRepoRunId !== VALID_RUN_ID ||
      child.rows[0].projectId !== child.rows[0].run_project_id ||
      child.rows[0].requirementId !== child.rows[0].run_requirement_id ||
      child.rows[0].requirementRevisionId !== child.rows[0].run_revision_id) {
    failures.push('valid legacy multi-repo child analysis lineage was not preserved');
  }

  await client.query(`INSERT INTO "MultiRepoAnalysisRun"
    (id, "projectId", "requirementId", "requirementRevisionId", "createdByUserId", "requestKey", "updatedAt")
    VALUES ('upgrade-foreign-multi-repo-run', $1, $2, $3, $4, 'upgrade-foreign-multi-repo-request', now())`,
  [FOREIGN_PROJECT_ID, FOREIGN_REQUIREMENT_ID, FOREIGN_REVISION_ID, createdByUserId]);
  try {
    await client.query(`UPDATE "ImpactAnalysis" SET "multiRepoRunId" = 'upgrade-foreign-multi-repo-run'
      WHERE id = 'upgrade-analysis'`);
    failures.push('ImpactAnalysis accepted a multi-repo run from another project and requirement revision');
  } catch (error) {
    const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : 'unknown';
    if (code !== '23503') {
      throw new Error(`Expected mismatched multi-repo child lineage to fail with 23503, received ${code}.`);
    }
  }
  return failures;
}

export async function seedCrossMultiRepoChildLineageHistory(client: Client, createdByUserId: string): Promise<void> {
  await client.query(`INSERT INTO "Project" (id, name, "updatedAt")
    VALUES ('upgrade-child-foreign-project', 'Foreign child project', now())`);
  await client.query(`INSERT INTO "Requirement" (id, "projectId", "updatedAt")
    VALUES ('upgrade-child-foreign-requirement', 'upgrade-child-foreign-project', now())`);
  await client.query(`INSERT INTO "RequirementRevision"
    (id, "requirementId", title, "rawText", "normalizedText", "readinessStatus")
    VALUES ('upgrade-child-foreign-revision', 'upgrade-child-foreign-requirement', 'Foreign revision',
      'Foreign revision text', 'Foreign revision text', 'READY_FOR_ANALYSIS')`);
  await client.query(`INSERT INTO "MultiRepoAnalysisRun"
    (id, "projectId", "requirementRevisionId", "createdByUserId", "requestKey", "updatedAt")
    VALUES ('upgrade-child-foreign-run', 'upgrade-child-foreign-project', 'upgrade-child-foreign-revision',
      $1, 'upgrade-child-foreign-request', now())`, [createdByUserId]);
  const child = await client.query(`UPDATE "ImpactAnalysis" SET "multiRepoRunId" = 'upgrade-child-foreign-run'
    WHERE id = 'upgrade-analysis'`);
  if (child.rowCount !== 1) throw new Error('Expected to seed the legacy cross-lineage child analysis.');
}

export async function assertCrossMultiRepoChildLineageHistoryPreserved(client: Client): Promise<void> {
  const child = await client.query(`SELECT "multiRepoRunId" FROM "ImpactAnalysis" WHERE id = 'upgrade-analysis'`);
  if (child.rowCount !== 1 || child.rows[0].multiRepoRunId !== 'upgrade-child-foreign-run') {
    throw new Error('Failed multi-repo child-lineage migration changed or deleted the historical mismatch row.');
  }
  const constraints = await client.query(`SELECT conname FROM pg_constraint
    WHERE conrelid = '"ImpactAnalysis"'::regclass
      AND conname IN ('ImpactAnalysis_multiRepoRunId_fkey',
        'ImpactAnalysis_multiRepoRunId_projectId_requirementId_requirementRevisionId_fkey')`);
  const names = new Set(constraints.rows.map((row) => row.conname));
  if (!names.has('ImpactAnalysis_multiRepoRunId_fkey') ||
      names.has('ImpactAnalysis_multiRepoRunId_projectId_requirementId_requirementRevisionId_fkey')) {
    throw new Error('Failed migration partially replaced the multi-repo child foreign key.');
  }
}

export async function seedCrossProjectMultiRepoHistory(client: Client, createdByUserId: string): Promise<void> {
  await client.query(`INSERT INTO "Project" (id, name, "updatedAt")
    VALUES ($1, 'Historical foreign project', now())`, [FOREIGN_PROJECT_ID]);
  await client.query(`INSERT INTO "Requirement" (id, "projectId", "updatedAt")
    VALUES ($1, $2, now())`, [FOREIGN_REQUIREMENT_ID, FOREIGN_PROJECT_ID]);
  await client.query(`INSERT INTO "RequirementRevision"
    (id, "requirementId", title, "rawText", "normalizedText", "readinessStatus")
    VALUES ($1, $2, 'Foreign requirement', 'Text', 'Text', 'READY_FOR_ANALYSIS')`,
  [FOREIGN_REVISION_ID, FOREIGN_REQUIREMENT_ID]);
  await client.query(`INSERT INTO "MultiRepoAnalysisRun"
    (id, "projectId", "requirementRevisionId", "createdByUserId", "requestKey", "updatedAt")
    VALUES ('upgrade-invalid-multi-repo-run', 'upgrade-project', $1, $2, 'upgrade-invalid-multi-repo-request', now())`,
  [FOREIGN_REVISION_ID, createdByUserId]);
}

export async function assertCrossProjectMultiRepoHistoryPreserved(client: Client): Promise<void> {
  const column = await client.query(`SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'MultiRepoAnalysisRun'
      AND column_name = 'requirementId'`);
  if (column.rowCount !== 0) {
    throw new Error('Failed multi-repo migration left the backfill column behind.');
  }

  const legacyForeignKey = await client.query(`SELECT 1 FROM pg_constraint
    WHERE conrelid = '"MultiRepoAnalysisRun"'::regclass
      AND conname = 'MultiRepoAnalysisRun_requirementRevisionId_fkey'`);
  if (legacyForeignKey.rowCount !== 1) {
    throw new Error('Failed multi-repo migration removed the previous revision foreign key.');
  }

  const run = await client.query(`SELECT run."projectId", requirement."projectId" AS revision_project_id
    FROM "MultiRepoAnalysisRun" AS run
    JOIN "RequirementRevision" AS revision ON revision."id" = run."requirementRevisionId"
    JOIN "Requirement" AS requirement ON requirement."id" = revision."requirementId"
    WHERE run."id" = 'upgrade-invalid-multi-repo-run'`);
  if (run.rowCount !== 1 || run.rows[0].projectId !== 'upgrade-project' ||
      run.rows[0].revision_project_id !== FOREIGN_PROJECT_ID) {
    throw new Error('Failed multi-repo migration changed or deleted the historical mismatch row.');
  }
}
