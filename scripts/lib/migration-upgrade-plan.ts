/** Migrations withheld from the baseline and exercised as the upgrade under test. */
export const UPGRADE_MIGRATIONS = [
  '20260726000000_normalize_user_email',
  '20260726010000_index_domain_event_type',
  '20261019000000_dependency_edge_provenance',
  '20261019010000_code_artifact_test_metadata',
  '20261020000000_reviewed_report_test_trace',
  '20261024130000_comprehension_projection_indexes',
  '20261028150000_requirement_create_idempotency',
] as const;
