import * as c from '@ba-helper/contracts';
import { z } from 'zod';
import { operation as op, type ControllerDocs } from './operation-doc';

export const repositoryDocs: Record<string, ControllerDocs> = {
  RepositoryController: { tag: 'Repositories & snapshots', operations: {
    create: op('Connect a public repository', c.repositoryCreateResponseSchema, { body: c.repositoryCreateRequestSchema, permission: 'repository:manage', bodyExample: { url: 'https://github.com/nestjs/typescript-starter' }, description: 'Only supported canonical public GitHub HTTPS repositories are accepted. The example is a NestJS starter, not a booking/refund implementation.' }),
    list: op('List project repositories', c.repositoryListResponseSchema, { query: c.paginationQuerySchema }),
    getDetail: op('Read repository details and artifact counts', c.repositoryDetailResponseSchema),
  } },
  RepositorySnapshotController: { tag: 'Repositories & snapshots', operations: {
    listSnapshots: op('List published repository snapshots', c.repositorySnapshotListResponseSchema, {
      query: z.object({ limit: z.coerce.number().int().min(1).max(50).default(20).describe('Requested count, clamped to 1–50. Invalid or zero values use 20.') }),
      description: 'Only usable READY or PARTIAL snapshots are published; in-progress and failed work belongs to scan jobs.',
    }),
    getSnapshotDrift: op('Compare immutable snapshot artifacts', c.repositorySnapshotDriftResponseSchema, {
      query: z.object({ targetSnapshotId: z.string().optional().describe('Defaults to the latest published snapshot, which may be the base snapshot.') }),
      description: 'Uses exact artifactKey and artifact content hashes. Changed/unchanged counts may be unavailable for incompatible analyzer versions or historical missing hashes.',
    }),
  } },
  ScanJobController: { tag: 'Scan jobs', operations: {
    create: op('Queue or reuse a repository scan', c.scanJobResponseSchema, { body: c.scanJobCreateRequestSchema, permission: 'scan:run', description: 'Use the same requestKey when retrying the same command; a new key requests a new scan. Use a ref that exists in the selected repository. Poll the returned job ID until terminal status. A completed job may publish a PARTIAL snapshot.', bodyExample: { ref: 'main', requestKey: '59a764a8-b5a6-4fb5-9497-df328d594f81' } }),
    get: op('Read scan status, diagnostics and capabilities', c.scanJobResponseSchema),
    getEvents: op('Read scan audit events', c.eventLogListResponseSchema),
  } },
  ArtifactController: { tag: 'Artifacts & source evidence', operations: {
    list: op('List artifacts in an immutable snapshot', c.artifactListResponseSchema),
  } },
  GraphController: { tag: 'Artifacts & source evidence', operations: {
    get: op('Read persisted snapshot dependency edges', c.graphResponseSchema),
  } },
  EvidenceController: { tag: 'Artifacts & source evidence', operations: {
    list: op('Read source evidence selected for an analysis', c.evidenceListResponseSchema),
  } },
  RequirementController: { tag: 'Requirements & revisions', operations: {
    createRequirementEndpoint: op('Create a requirement and its first revision', c.requirementCreateResponseSchema, { body: c.requirementCreateRequestSchema, permission: 'requirement:create', bodyExample: { title: 'Cancel paid bookings with a refund', rawText: 'Allow users to cancel paid bookings and receive a refund. Identify affected cancellation and payment code, missing refund policy, risks and QA scenarios.', submitForReadinessCheck: true } }),
    createRevisionEndpoint: op('Create an immutable requirement revision', c.requirementRevisionCreateResponseSchema, { body: c.requirementRevisionCreateRequestSchema, permission: 'requirement:create' }),
    qualifyRevisionEndpoint: op('Qualify a revision for analysis', c.requirementRevisionQualifyResponseSchema, { permission: 'requirement:create', description: 'Read the returned readinessStatus and validationIssues before starting analysis. Missing policy is kept as clarification, never invented.' }),
    listRequirementsEndpoint: op('List requirements with their latest revision', c.requirementListResponseSchema),
    getRequirementEndpoint: op('Read a requirement and revision history', c.requirementDetailResponseSchema),
  } },
};
