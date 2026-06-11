# Scoped Authorization Audit

Last updated: 2026-06-07

Use code as source of truth if this table drifts.

## Summary

Phase 15A, 15B, 15C, and 15D foundation are implemented.

Current backend authorization model:

- public routes stay explicit
- authenticated non-project routes use global auth only
- project-owned routes must enforce `ProjectPermissionService`
- outside membership scope returns `404`
- same-project insufficient role returns `403`

## Route Coverage

| Method | Path | Resource | Project-owned? | Current enforcement | Expected permission | Status |
|---|---|---|---|---|---|---|
| `POST` | `/api/v1/auth/dev-login` | dev auth bootstrap | No | `@Public()` + env gate | Public | PUBLIC |
| `GET` | `/api/v1/auth/me` | current actor | No | auth only | Authenticated global | OK |
| `GET` | `/api/v1/system/health` | system health | No | `@Public()` | Public | PUBLIC |
| `GET` | `/api/v1/workspace/current` | workspace bootstrap | Mixed | `@Public()` + optional bearer parse | Public bootstrap | PUBLIC |
| `POST` | `/api/v1/projects` | project create | Platform/project bootstrap | global `ADMIN` | Platform/admin | PLATFORM |
| `GET` | `/api/v1/projects/:projectId/repositories` | repository list | Yes | `assertCanReadProject` | `project:read` | OK |
| `POST` | `/api/v1/projects/:projectId/repositories` | repository create | Yes | global `ADMIN` + `assertPermission(..., repository:manage)` | `repository:manage` | OK |
| `GET` | `/api/v1/projects/:projectId/repositories/:repositoryId` | repository detail | Yes | `assertCanReadRepository` | `project:read` | OK |
| `GET` | `/api/v1/repositories/:repositoryId/scan-jobs/:scanJobId` | scan job detail | Yes | `assertCanReadScanJob` | `project:read` | OK |
| `POST` | `/api/v1/repositories/:repositoryId/scan-jobs` | scan queue | Yes | global `ADMIN` + `assertPermissionForRepository(..., scan:run)` | `scan:run` | OK |
| `GET` | `/api/v1/projects/:projectId/requirements` | requirement list | Yes | `assertCanReadProject` | `project:read` | OK |
| `POST` | `/api/v1/projects/:projectId/requirements` | requirement create | Yes | global `ADMIN` + `assertPermission(..., requirement:create)` | `requirement:create` | OK |
| `GET` | `/api/v1/projects/:projectId/requirements/:requirementId` | requirement detail | Yes | `assertCanReadRequirement` | `project:read` | OK |
| `POST` | `/api/v1/requirements/:requirementId/revisions` | revision create | Yes | global `ADMIN` + `assertPermissionForRequirement(..., requirement:create)` | `requirement:create` | OK |
| `POST` | `/api/v1/requirement-revisions/:revisionId/qualify` | revision qualify | Yes | global `ADMIN` + `assertPermissionForRequirementRevision(..., requirement:create)` | `requirement:create` | OK |
| `GET` | `/api/v1/projects/:projectId/analyses` | analysis list | Yes | `assertCanReadProject` | `project:read` | OK |
| `POST` | `/api/v1/requirement-revisions/:revisionId/impact-analyses` | base analysis create | Yes | global `ADMIN` + `assertPermissionForRequirementRevision(..., analysis:create)` | `analysis:create` | OK |
| `GET` | `/api/v1/impact-analyses/:analysisId` | analysis detail | Yes | `assertCanReadAnalysis` | `project:read` | OK |
| `POST` | `/api/v1/impact-analyses/:analysisId/finalize` | analysis finalize | Yes | global `ADMIN` + `assertPermissionForAnalysis(..., analysis:finalize)` | `analysis:finalize` | OK |
| `GET` | `/api/v1/impact-analyses/:analysisId/graph` | impact graph | Yes | `assertCanReadAnalysis` | `project:read` | OK |
| `GET` | `/api/v1/impact-analyses/:analysisId/qa-coverage` | QA coverage | Yes | `assertCanReadAnalysis` | `project:read` | OK |
| `GET` | `/api/v1/impact-analyses/:analysisId/review-queue` | review queue | Yes | `assertCanReadAnalysis` | `project:read` | OK |
| `GET` | `/api/v1/impact-analyses/:analysisId/diff` | impact diff | Yes | `assertCanReadAnalysis` | `project:read` | OK |
| `GET` | `/api/v1/impact-analyses/:analysisId/lineage` | lineage timeline | Yes | `assertCanReadAnalysis` | `project:read` | OK |
| `GET` | `/api/v1/impact-analyses/:analysisId/review-decisions` | review decision history | Yes | `assertCanReadAnalysis` | `project:read` | OK |
| `GET` | `/api/v1/impact-analyses/:analysisId/review-decisions/latest` | latest review decision | Yes | `assertCanReadAnalysis` | `project:read` | OK |
| `POST` | `/api/v1/impact-analyses/:analysisId/review-decisions` | review decision write | Yes | global `ADMIN/REVIEWER` + `assertPermissionForAnalysis(..., review:write)` | `review:write` | OK |
| `GET` | `/api/v1/impact-analyses/:analysisId/clarifications` | clarification list | Yes | `assertCanReadAnalysis` | `project:read` | OK |
| `POST` | `/api/v1/impact-analyses/:analysisId/clarifications` | clarification create | Yes | global `ADMIN/REVIEWER` + `assertPermissionForAnalysis(..., clarification:write)` | `clarification:write` | OK |
| `PATCH` | `/api/v1/clarifications/:id/answer` | clarification answer | Yes | global `ADMIN/REVIEWER` + `assertPermissionForClarification(..., clarification:write)` | `clarification:write` | OK |
| `PATCH` | `/api/v1/clarifications/:id/dismiss` | clarification dismiss | Yes | global `ADMIN/REVIEWER` + `assertPermissionForClarification(..., clarification:write)` | `clarification:write` | OK |
| `POST` | `/api/v1/clarifications/:id/convert-to-revision` | clarification convert | Yes | global `ADMIN` + `assertPermissionForClarification(..., requirement:create)` | `requirement:create` | OK |
| `GET` | `/api/v1/impact-analyses/:analysisId/review-clarifications` | review clarification list | Yes | `assertCanReadAnalysis` | `project:read` | OK |
| `POST` | `/api/v1/impact-analyses/:analysisId/review-clarifications` | review clarification create | Yes | global `ADMIN/REVIEWER` + `assertPermissionForAnalysis(..., clarification:write)` | `clarification:write` | OK |
| `POST` | `/api/v1/review-clarifications/:clarificationId/answer` | review clarification answer | Yes | global `ADMIN/REVIEWER` + `assertPermissionForReviewClarification(..., clarification:write)` | `clarification:write` | OK |
| `POST` | `/api/v1/review-clarifications/:clarificationId/derived-analyses` | derived analysis create | Yes | global `ADMIN/REVIEWER` + `assertPermissionForReviewClarification(..., analysis:create-derived)` | `analysis:create-derived` | OK |
| `GET` | `/api/v1/impact-analyses/:analysisId/review-notes` | review note list | Yes | `assertCanReadAnalysis` | `project:read` | OK |
| `POST` | `/api/v1/impact-analyses/:analysisId/review-notes` | review note write | Yes | global `ADMIN/REVIEWER` + `assertPermissionForAnalysis(..., review:write)` | `review:write` | OK |
| `GET` | `/api/v1/impact-analyses/:analysisId/insights` | insight list | Yes | `assertCanReadAnalysis` | `project:read` | OK |
| `POST` | `/api/v1/insights/:insightId/confirm|reject|review` | insight review | Yes | global `ADMIN/REVIEWER` + `assertPermissionForInsight(..., review:write)` | `review:write` | OK |
| `GET` | `/api/v1/impact-analyses/:analysisId/traceability` | traceability list | Yes | `assertCanReadAnalysis` | `project:read` | OK |
| `POST` | `/api/v1/traceability-links/:linkId/confirm|reject|review` | traceability review | Yes | global `ADMIN/REVIEWER` + `assertPermissionForTraceabilityLink(..., review:write)` | `review:write` | OK |
| `GET` | `/api/v1/impact-analyses/:analysisId/evidence` | evidence list | Yes | `assertCanReadAnalysis` | `project:read` | OK |
| `GET` | `/api/v1/impact-analyses/:analysisId/documents` | document list | Yes | `assertCanReadAnalysis` | `project:read` | OK |
| `GET` | `/api/v1/impact-analyses/:analysisId/approved-report` | approved report read | Yes | `assertCanReadAnalysis` | `project:read` | OK |
| `GET` | `/api/v1/impact-analyses/:analysisId/approved-report/export.md|pdf` | report export | Yes | `assertPermissionForAnalysis(..., report:export)` | `report:export` | OK |
| `GET` | `/api/v1/snapshots/:snapshotId/artifacts` | snapshot artifacts | Yes | `assertCanReadSnapshot` | `project:read` | OK |
| `GET` | `/api/v1/snapshots/:snapshotId/graph` | snapshot graph | Yes | `assertCanReadSnapshot` | `project:read` | OK |

## Residual Risks

- Global role guards still exist and are intentionally layered with project
  scope. This is transitional and acceptable for current MVP/dev mode.
- Membership management UI and project switching are not implemented yet.
- This audit covers controller-level authorization. If future background jobs
  expose new project-owned HTTP routes, they must be added here.
