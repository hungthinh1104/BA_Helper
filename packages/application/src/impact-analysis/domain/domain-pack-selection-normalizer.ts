import type {
  DomainPackSelectedBy,
  DomainProfileCapabilityStatus,
  ResolvedDomainPackSelection,
} from '@ba-helper/contracts';

export type DomainPackSelectionRecord = {
  requestedDomainPackId?: string | null;
  resolvedDomainPackId?: string | null;
  resolvedDomainPackVersion?: string | null;
  resolvedDomainPackStatus?: string | null;
  domainPackSelectedBy?: string | null;
  domainPackResolvedAt?: Date | string | null;
  metadata?: unknown;
};

export type DomainPackProjection = {
  id: string;
  version: string;
  status: DomainProfileCapabilityStatus;
  selectedBy: DomainPackSelectedBy;
};

export function readResolvedDomainPackSelection(
  record: DomainPackSelectionRecord,
  options: { ignoreUnresolvedDefaultFallback?: boolean } = {},
): ResolvedDomainPackSelection | null {
  if (
    options.ignoreUnresolvedDefaultFallback &&
    isUnresolvedDefaultFallback(record)
  ) {
    return readSelectionFromMetadata(record.metadata);
  }

  const columnSelection = readSelectionFromColumns(record);
  if (columnSelection) {
    return columnSelection;
  }

  return readSelectionFromMetadata(record.metadata);
}

export function projectDomainPackSelection(
  record: DomainPackSelectionRecord,
): DomainPackProjection | null {
  const selection = readResolvedDomainPackSelection(record);
  if (!selection) return null;

  return {
    id: selection.resolvedDomainPackId,
    version: selection.resolvedDomainPackVersion,
    status: selection.resolvedDomainPackStatus,
    selectedBy: selection.selectedBy,
  };
}

export function sameResolvedDomainPackSelection(
  current: ResolvedDomainPackSelection | null,
  next: ResolvedDomainPackSelection | null,
): boolean {
  const normalizedCurrent = current
    ? normalizeResolvedDomainPackSelection(current)
    : null;
  const normalizedNext = next
    ? normalizeResolvedDomainPackSelection(next)
    : null;

  return (
    normalizedCurrent?.resolvedDomainPackId === normalizedNext?.resolvedDomainPackId &&
    normalizedCurrent?.resolvedDomainPackVersion === normalizedNext?.resolvedDomainPackVersion &&
    normalizedCurrent?.resolvedDomainPackStatus === normalizedNext?.resolvedDomainPackStatus &&
    normalizedCurrent?.selectedBy === normalizedNext?.selectedBy
  );
}

export function normalizeResolvedDomainPackSelection(
  selection: ResolvedDomainPackSelection,
): ResolvedDomainPackSelection | null {
  return buildResolvedSelection({
    requestedDomainPackId: selection.requestedDomainPackId,
    resolvedDomainPackId: selection.resolvedDomainPackId,
    resolvedDomainPackVersion: selection.resolvedDomainPackVersion,
    resolvedDomainPackStatus: selection.resolvedDomainPackStatus,
    selectedBy: selection.selectedBy,
    resolvedAt: selection.resolvedAt,
  });
}

function readSelectionFromColumns(
  record: DomainPackSelectionRecord,
): ResolvedDomainPackSelection | null {
  return buildResolvedSelection({
    requestedDomainPackId: record.requestedDomainPackId ?? null,
    resolvedDomainPackId: record.resolvedDomainPackId,
    resolvedDomainPackVersion: record.resolvedDomainPackVersion,
    resolvedDomainPackStatus: record.resolvedDomainPackStatus,
    selectedBy: record.domainPackSelectedBy,
    resolvedAt: record.domainPackResolvedAt,
  });
}

function readSelectionFromMetadata(metadata: unknown): ResolvedDomainPackSelection | null {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    return null;
  }

  const data = metadata as Record<string, unknown>;
  const selectedDomainPack = data.selectedDomainPack;
  if (
    selectedDomainPack &&
    typeof selectedDomainPack === 'object' &&
    !Array.isArray(selectedDomainPack)
  ) {
    const selected = selectedDomainPack as Record<string, unknown>;
    const selection = buildResolvedSelection({
      requestedDomainPackId: selected.requestedDomainPackId,
      resolvedDomainPackId: selected.resolvedDomainPackId,
      resolvedDomainPackVersion: selected.resolvedDomainPackVersion,
      resolvedDomainPackStatus: selected.resolvedDomainPackStatus,
      selectedBy: selected.selectedBy,
      resolvedAt: selected.resolvedAt,
    });
    if (selection) return selection;
  }

  const domainPack = data.domainPack;
  if (!domainPack || typeof domainPack !== 'object' || Array.isArray(domainPack)) {
    return null;
  }

  const pack = domainPack as Record<string, unknown>;
  return buildResolvedSelection({
    requestedDomainPackId: null,
    resolvedDomainPackId: pack.id,
    resolvedDomainPackVersion: pack.version,
    resolvedDomainPackStatus: pack.status,
    selectedBy: pack.selectedBy,
    resolvedAt: new Date(0).toISOString(),
  });
}

function buildResolvedSelection(params: {
  requestedDomainPackId?: unknown;
  resolvedDomainPackId?: unknown;
  resolvedDomainPackVersion?: unknown;
  resolvedDomainPackStatus?: unknown;
  selectedBy?: unknown;
  resolvedAt?: unknown;
}): ResolvedDomainPackSelection | null {
  const resolved = normalizePackId(params.resolvedDomainPackId);
  const version = normalizeVersion(params.resolvedDomainPackVersion);
  const status = normalizeDomainPackStatus(params.resolvedDomainPackStatus);
  const selectedBy = normalizeDomainPackSelectedBy(params.selectedBy);

  if (!resolved || !version || !status || !selectedBy) {
    return null;
  }

  if (resolved.version && resolved.version !== version) {
    return null;
  }

  const requested =
    params.requestedDomainPackId === null || params.requestedDomainPackId === undefined
      ? null
      : normalizePackId(params.requestedDomainPackId);
  if (requested === null && params.requestedDomainPackId !== null && params.requestedDomainPackId !== undefined) {
    return null;
  }

  return {
    requestedDomainPackId: requested?.id ?? null,
    resolvedDomainPackId: resolved.id,
    resolvedDomainPackVersion: version,
    resolvedDomainPackStatus: status,
    selectedBy,
    resolvedAt: normalizeResolvedAt(params.resolvedAt),
  };
}

function normalizePackId(value: unknown): { id: string; version: string | null } | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase();
  if (!normalized) return null;

  const [id, version, extra] = normalized.split('@');
  if (!id || extra !== undefined) return null;

  return {
    id,
    version: version && version.trim().length > 0 ? version.trim() : null,
  };
}

function normalizeVersion(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0
    ? value.trim()
    : null;
}

function normalizeDomainPackStatus(
  value: unknown,
): DomainProfileCapabilityStatus | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toUpperCase();
  if (
    normalized === 'STABLE' ||
    normalized === 'PARTIAL' ||
    normalized === 'EXPERIMENTAL' ||
    normalized === 'FALLBACK'
  ) {
    return normalized;
  }
  return null;
}

function normalizeDomainPackSelectedBy(value: unknown): DomainPackSelectedBy | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase();
  if (normalized === 'explicit' || normalized === 'manual_config') {
    return 'EXPLICIT';
  }
  if (normalized === 'repository_profile') {
    return 'REPOSITORY_PROFILE';
  }
  if (normalized === 'fallback' || normalized === 'safe_default') {
    return 'FALLBACK';
  }
  return null;
}

function normalizeResolvedAt(value: unknown): string {
  if (value instanceof Date) {
    return value.toISOString();
  }
  return typeof value === 'string' && value.trim().length > 0
    ? value.trim()
    : new Date(0).toISOString();
}

function isUnresolvedDefaultFallback(record: DomainPackSelectionRecord): boolean {
  return (
    !record.metadata &&
    !record.requestedDomainPackId &&
    record.resolvedDomainPackId === 'general' &&
    record.resolvedDomainPackVersion === '0.0.0' &&
    record.resolvedDomainPackStatus === 'FALLBACK' &&
    record.domainPackSelectedBy === 'FALLBACK'
  );
}
