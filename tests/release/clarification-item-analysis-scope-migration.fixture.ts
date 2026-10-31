import type { Client } from 'pg';

export async function seedLegacyClarificationItem(client: Client): Promise<void> {
  await insertInsight(client, 'upgrade-clarification-insight', 'upgrade-analysis');
  await insertInsight(client, 'upgrade-other-clarification-insight', 'upgrade-other-analysis');
  await client.query(`INSERT INTO clarification_item
    (id, impact_analysis_id, source_insight_id, question, status, created_at, updated_at)
    VALUES ('upgrade-clarification', 'upgrade-analysis', 'upgrade-clarification-insight',
      'Historical clarification', 'OPEN', now(), now())`);
}

export async function verifyLegacyClarificationItem(client: Client): Promise<string[]> {
  const failures: string[] = [];
  const clarification = await client.query(`SELECT impact_analysis_id, source_insight_id, question
    FROM clarification_item WHERE id = 'upgrade-clarification'`);
  if (clarification.rowCount !== 1 || clarification.rows[0].impact_analysis_id !== 'upgrade-analysis' ||
      clarification.rows[0].source_insight_id !== 'upgrade-clarification-insight' ||
      clarification.rows[0].question !== 'Historical clarification') {
    failures.push('legacy clarification identity or content changed during upgrade');
  }

  const constraint = await client.query(`SELECT convalidated FROM pg_constraint
    WHERE conrelid = 'clarification_item'::regclass
      AND conname = 'clarification_item_source_insight_id_impact_analysis_id_fkey'`);
  if (constraint.rowCount !== 1 || !constraint.rows[0].convalidated) {
    failures.push('same-analysis clarification foreign key is missing or unvalidated');
  }
  const uniqueIndexes = await client.query(`SELECT
      to_regclass('clarification_item_source_insight_id_key') AS old_index,
      to_regclass('clarification_item_source_insight_id_impact_analysis_id_key') AS scoped_index`);
  if (uniqueIndexes.rows[0]?.old_index || !uniqueIndexes.rows[0]?.scoped_index) {
    failures.push('clarification source-insight uniqueness was not replaced with its analysis-scoped key');
  }

  try {
    await client.query(`INSERT INTO clarification_item
      (id, impact_analysis_id, source_insight_id, question, status, created_at, updated_at)
      VALUES ('upgrade-cross-analysis-clarification', 'upgrade-analysis',
        'upgrade-other-clarification-insight', 'Cross-analysis question', 'OPEN', now(), now())`);
    failures.push('clarification accepted a source insight from another analysis');
  } catch (error) {
    const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : 'unknown';
    if (code !== '23503') {
      throw new Error(`Expected cross-analysis clarification to fail with 23503, received ${code}.`);
    }
  }
  const rejected = await client.query(`SELECT count(*)::int AS count FROM clarification_item
    WHERE id = 'upgrade-cross-analysis-clarification'`);
  if (rejected.rows[0]?.count !== 0) failures.push('cross-analysis clarification row was persisted');
  return failures;
}

export async function seedCrossAnalysisClarificationHistory(client: Client): Promise<void> {
  await insertInsight(client, 'upgrade-invalid-clarification-insight', 'upgrade-other-analysis');
  await client.query(`INSERT INTO clarification_item
    (id, impact_analysis_id, source_insight_id, question, status, created_at, updated_at)
    VALUES ('upgrade-invalid-clarification', 'upgrade-analysis',
      'upgrade-invalid-clarification-insight', 'Historical cross-analysis question', 'OPEN', now(), now())`);
}

export async function assertCrossAnalysisClarificationHistoryPreserved(client: Client): Promise<void> {
  const clarification = await client.query(`SELECT impact_analysis_id, source_insight_id, question
    FROM clarification_item WHERE id = 'upgrade-invalid-clarification'`);
  if (clarification.rowCount !== 1 || clarification.rows[0].impact_analysis_id !== 'upgrade-analysis' ||
      clarification.rows[0].source_insight_id !== 'upgrade-invalid-clarification-insight' ||
      clarification.rows[0].question !== 'Historical cross-analysis question') {
    throw new Error('Fail-closed migration changed or deleted the invalid historical clarification.');
  }

  const constraints = await client.query(`SELECT conname FROM pg_constraint
    WHERE conrelid = 'clarification_item'::regclass
      AND conname IN ('clarification_item_impact_analysis_id_fkey',
        'clarification_item_source_insight_id_fkey',
        'clarification_item_source_insight_id_impact_analysis_id_fkey')`);
  const names = new Set(constraints.rows.map((row) => row.conname));
  if (!names.has('clarification_item_impact_analysis_id_fkey') ||
      !names.has('clarification_item_source_insight_id_fkey') ||
      names.has('clarification_item_source_insight_id_impact_analysis_id_fkey')) {
    throw new Error('Failed clarification migration partially replaced its foreign keys.');
  }
  const indexes = await client.query(`SELECT
      to_regclass('clarification_item_source_insight_id_key') AS old_index,
      to_regclass('clarification_item_source_insight_id_impact_analysis_id_key') AS scoped_index`);
  if (!indexes.rows[0]?.old_index || indexes.rows[0]?.scoped_index) {
    throw new Error('Failed clarification migration partially replaced its unique indexes.');
  }
}

async function insertInsight(client: Client, id: string, analysisId: string): Promise<void> {
  await client.query(`INSERT INTO "BaInsight"
    (id, "impactAnalysisId", "insightKey", "insightType", certainty, "reviewStatus",
      title, description, "createdAt", "updatedAt")
    VALUES ($1, $2, $1, 'QUESTION', 'UNKNOWN', 'NEEDS_REVIEW', $1, $1, now(), now())`, [id, analysisId]);
}
