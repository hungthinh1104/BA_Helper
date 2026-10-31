import type { Client } from 'pg';

export async function seedLegacyReviewClarificationRequest(client: Client, reviewerId: string): Promise<void> {
  await insertDecision(client, 'upgrade-review-decision', 'upgrade-analysis', reviewerId);
  await insertDecision(client, 'upgrade-other-review-decision', 'upgrade-other-analysis', reviewerId);
  await client.query(`INSERT INTO review_clarification_request
    (id, analysis_id, review_decision_id, question, status, created_by_user_id, created_at)
    VALUES ('upgrade-review-clarification', 'upgrade-analysis', 'upgrade-review-decision',
      'Historical review clarification', 'OPEN', $1, now())`, [reviewerId]);
}

export async function verifyLegacyReviewClarificationRequest(client: Client, reviewerId: string): Promise<string[]> {
  const failures: string[] = [];
  const request = await client.query(`SELECT analysis_id, review_decision_id, question, created_by_user_id
    FROM review_clarification_request WHERE id = 'upgrade-review-clarification'`);
  if (request.rowCount !== 1 || request.rows[0].analysis_id !== 'upgrade-analysis' ||
      request.rows[0].review_decision_id !== 'upgrade-review-decision' ||
      request.rows[0].question !== 'Historical review clarification' ||
      request.rows[0].created_by_user_id !== reviewerId) {
    failures.push('legacy review clarification identity or content changed during upgrade');
  }

  const constraint = await client.query(`SELECT convalidated FROM pg_constraint
    WHERE conrelid = 'review_clarification_request'::regclass
      AND conname = 'review_clarification_request_review_decision_id_analysis_id_fkey'`);
  if (constraint.rowCount !== 1 || !constraint.rows[0].convalidated) {
    failures.push('same-analysis review-decision foreign key is missing or unvalidated');
  }
  const parentIndex = await client.query(`SELECT to_regclass('analysis_review_decision_id_analysis_id_key') AS idx`);
  if (!parentIndex.rows[0]?.idx) failures.push('review decision composite identity index is missing');

  try {
    await client.query(`INSERT INTO review_clarification_request
      (id, analysis_id, review_decision_id, question, status, created_by_user_id, created_at)
      VALUES ('upgrade-cross-analysis-review-request', 'upgrade-analysis',
        'upgrade-other-review-decision', 'Cross-analysis question', 'OPEN', $1, now())`, [reviewerId]);
    failures.push('review clarification accepted a decision from another analysis');
  } catch (error) {
    const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : 'unknown';
    if (code !== '23503') {
      throw new Error(`Expected cross-analysis review clarification to fail with 23503, received ${code}.`);
    }
  }
  const rejected = await client.query(`SELECT count(*)::int AS count FROM review_clarification_request
    WHERE id = 'upgrade-cross-analysis-review-request'`);
  if (rejected.rows[0]?.count !== 0) failures.push('cross-analysis review clarification row was persisted');
  return failures;
}

export async function seedCrossAnalysisReviewClarificationHistory(client: Client, reviewerId: string): Promise<void> {
  await insertDecision(client, 'upgrade-invalid-review-decision', 'upgrade-other-analysis', reviewerId);
  await client.query(`INSERT INTO review_clarification_request
    (id, analysis_id, review_decision_id, question, status, created_by_user_id, created_at)
    VALUES ('upgrade-invalid-review-request', 'upgrade-analysis', 'upgrade-invalid-review-decision',
      'Historical cross-analysis request', 'OPEN', $1, now())`, [reviewerId]);
}

export async function assertCrossAnalysisReviewClarificationHistoryPreserved(client: Client): Promise<void> {
  const request = await client.query(`SELECT analysis_id, review_decision_id, question
    FROM review_clarification_request WHERE id = 'upgrade-invalid-review-request'`);
  if (request.rowCount !== 1 || request.rows[0].analysis_id !== 'upgrade-analysis' ||
      request.rows[0].review_decision_id !== 'upgrade-invalid-review-decision' ||
      request.rows[0].question !== 'Historical cross-analysis request') {
    throw new Error('Fail-closed migration changed or deleted the invalid historical review clarification.');
  }

  const constraints = await client.query(`SELECT conname FROM pg_constraint
    WHERE conrelid = 'review_clarification_request'::regclass
      AND conname IN ('review_clarification_request_analysis_id_fkey',
        'review_clarification_request_review_decision_id_fkey',
        'review_clarification_request_review_decision_id_analysis_id_fkey')`);
  const names = new Set(constraints.rows.map((row) => row.conname));
  if (!names.has('review_clarification_request_analysis_id_fkey') ||
      !names.has('review_clarification_request_review_decision_id_fkey') ||
      names.has('review_clarification_request_review_decision_id_analysis_id_fkey')) {
    throw new Error('Failed review-clarification migration partially replaced its foreign keys.');
  }
  const index = await client.query(`SELECT to_regclass('analysis_review_decision_id_analysis_id_key') AS idx`);
  if (index.rows[0]?.idx) throw new Error('Failed review-clarification migration partially added its composite index.');
}

async function insertDecision(client: Client, id: string, analysisId: string, reviewerId: string): Promise<void> {
  await client.query(`INSERT INTO analysis_review_decision
    (id, analysis_id, decision, reviewed_by_user_id, created_at)
    VALUES ($1, $2, 'NEEDS_MORE_CLARIFICATION', $3, now())`, [id, analysisId, reviewerId]);
}
