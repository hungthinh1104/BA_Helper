import { createHash } from 'crypto';
import { Prisma } from '@prisma/client';
import { AppError } from '@ba-helper/shared';
import type { ResolvedDomainPackSelection } from '@ba-helper/contracts';
import {
  readResolvedDomainPackSelection,
  sameResolvedDomainPackSelection,
} from '@ba-helper/application';

type ExistingRun = {
  requirementRevisionId: string;
  requestPayloadHash?: string | null;
  requestedDomainPackId?: string | null;
  resolvedDomainPackId?: string | null;
  resolvedDomainPackVersion?: string | null;
  resolvedDomainPackStatus?: string | null;
  domainPackSelectedBy?: string | null;
  domainPackResolvedAt?: Date | string | null;
  analyses: Array<{
    snapshot: {
      id?: string;
      repositoryId: string;
      repository?: { canonicalUrl?: string } | null;
    };
    sourceTargetId?: string | null;
    sourceTarget?: { id: string } | null;
    metadata?: unknown;
  }>;
};

export type MultiRepoRequestPlanEntry = {
  repositoryId: string;
  repositoryDisplayName: string;
  snapshotId: string;
  sourceTargetId: string;
};

export function hashMultiRepoRequestPayload(params: {
  requirementRevisionId: string;
  repositoryIds: string[];
  allowPartialSnapshot: boolean;
  explicitDomainPack: ResolvedDomainPackSelection | null;
}) {
  const selection = params.explicitDomainPack;
  const canonicalPayload = {
    requirementRevisionId: params.requirementRevisionId,
    repositoryIds: [...params.repositoryIds].sort(),
    allowPartialSnapshot: params.allowPartialSnapshot,
    domainPack: selection
      ? {
          requestedDomainPackId: selection.requestedDomainPackId,
          resolvedDomainPackId: selection.resolvedDomainPackId,
          resolvedDomainPackVersion: selection.resolvedDomainPackVersion,
          resolvedDomainPackStatus: selection.resolvedDomainPackStatus,
          selectedBy: selection.selectedBy,
        }
      : null,
  };

  return createHash('sha256').update(JSON.stringify(canonicalPayload)).digest('hex');
}

export function readMultiRepoRequestPlan(
  value: unknown,
  repositoryIds: string[],
): MultiRepoRequestPlanEntry[] | null {
  if (value === null || value === undefined) return null;
  if (!Array.isArray(value)) throw new Error('Persisted multi-repo request plan is invalid.');

  const plans = value.map((entry): MultiRepoRequestPlanEntry | null => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return null;
    const plan = entry as Record<string, unknown>;
    if (
      typeof plan.repositoryId !== 'string' ||
      typeof plan.repositoryDisplayName !== 'string' ||
      typeof plan.snapshotId !== 'string' ||
      typeof plan.sourceTargetId !== 'string'
    ) return null;
    return {
      repositoryId: plan.repositoryId,
      repositoryDisplayName: plan.repositoryDisplayName,
      snapshotId: plan.snapshotId,
      sourceTargetId: plan.sourceTargetId,
    };
  });

  const resolvedPlans = plans.filter((plan): plan is MultiRepoRequestPlanEntry => plan !== null);
  const plannedRepositoryIds = resolvedPlans.map((plan) => plan.repositoryId).sort();
  const requestedRepositoryIds = [...repositoryIds].sort();
  if (
    resolvedPlans.length !== plans.length ||
    plannedRepositoryIds.length !== requestedRepositoryIds.length ||
    plannedRepositoryIds.some((id, index) => id !== requestedRepositoryIds[index])
  ) throw new Error('Persisted multi-repo request plan does not match its payload.');

  return resolvedPlans;
}

export function reconstructMultiRepoRequestPlan(
  run: ExistingRun,
  repositoryIds: string[],
): MultiRepoRequestPlanEntry[] | null {
  const byRepository = new Map<string, MultiRepoRequestPlanEntry>();
  for (const analysis of run.analyses) {
    const snapshotId = analysis.snapshot.id;
    const sourceTargetId = analysis.sourceTargetId ?? analysis.sourceTarget?.id;
    const canonicalUrl = analysis.snapshot.repository?.canonicalUrl;
    if (!snapshotId || !sourceTargetId || !canonicalUrl || byRepository.has(analysis.snapshot.repositoryId)) {
      return null;
    }

    byRepository.set(analysis.snapshot.repositoryId, {
      repositoryId: analysis.snapshot.repositoryId,
      repositoryDisplayName: canonicalUrl.split('/').pop() || canonicalUrl,
      snapshotId,
      sourceTargetId,
    });
  }

  if (byRepository.size !== repositoryIds.length || repositoryIds.some((id) => !byRepository.has(id))) {
    return null;
  }

  return repositoryIds.map((id) => byRepository.get(id)!);
}

export function assertRunRequestMatches(
  run: ExistingRun,
  request: {
    requirementRevisionId: string;
    repositoryIds: string[];
    explicitDomainPack: ResolvedDomainPackSelection | null;
    requestPayloadHash: string;
  },
) {
  const requestMatches = run.requestPayloadHash
    ? run.requestPayloadHash === request.requestPayloadHash
    : legacyRunMatchesRequest(run, request);
  if (!requestMatches) {
    throw new AppError(
      'REQUEST_KEY_MISMATCH',
      'Request key reuse with different multi-repo payload.',
    );
  }
}

function legacyRunMatchesRequest(
  run: ExistingRun,
  request: {
    requirementRevisionId: string;
    repositoryIds: string[];
    explicitDomainPack: ResolvedDomainPackSelection | null;
  },
) {
  const existingRepositoryIds = run.analyses
    .map((analysis) => analysis.snapshot.repositoryId)
    .sort();
  const requestedRepositoryIds = [...request.repositoryIds].sort();
  return (
    run.requirementRevisionId === request.requirementRevisionId &&
    existingRepositoryIds.length === requestedRepositoryIds.length &&
    existingRepositoryIds.every(
      (repositoryId, index) => repositoryId === requestedRepositoryIds[index],
    ) &&
    existingRunMatchesDomainPack(run, request.explicitDomainPack)
  );
}

function existingRunMatchesDomainPack(
  run: ExistingRun,
  explicitDomainPack: ResolvedDomainPackSelection | null,
) {
  if (!explicitDomainPack) return true;

  const runSelection = readResolvedDomainPackSelection(run);
  if (runSelection) {
    return sameResolvedDomainPackSelection(runSelection, explicitDomainPack);
  }

  return run.analyses.every((analysis) => {
    const selected = readResolvedDomainPackSelection(analysis);
    return sameResolvedDomainPackSelection(selected, explicitDomainPack);
  });
}

export function isUniqueConstraintError(error: unknown): error is Prisma.PrismaClientKnownRequestError {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}
