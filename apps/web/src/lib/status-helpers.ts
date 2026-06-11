import { RepositoryDetailResponse, ImpactAnalysisResponse } from '@ba-helper/contracts';

/**
 * Scan Job Status Helpers
 */
export function isScanJobActive(status?: string): boolean {
  return status === 'QUEUED' || status === 'RUNNING';
}

export function isScanJobTerminal(status?: string): boolean {
  return status === 'COMPLETED' || status === 'FAILED' || status === 'CANCELLED';
}

/**
 * Indexing Status Helpers
 */
export function isIndexingActive(indexStatus?: string): boolean {
  return indexStatus === 'VECTOR_INDEXING';
}

/**
 * Impact Analysis Status Helpers
 */
export function isAnalysisActive(status?: string): boolean {
  return status === 'QUEUED' || status === 'RUNNING';
}

export function isAnalysisTerminal(status?: string): boolean {
  return status === 'WAITING_FOR_REVIEW' || status === 'COMPLETED' || status === 'FAILED' || status === 'CANCELLED';
}

/**
 * Polling Capability Helpers
 */

/**
 * A repository detail should be polled if there's an active scan job
 * or if the latest snapshot is currently indexing.
 */
export function canPollRepositoryDetail(repository?: RepositoryDetailResponse): boolean {
  if (!repository) return false;

  const scanJobStatus = repository.latestScanJob?.status;
  const indexStatus = repository.latestSnapshot?.indexStatus;

  return isScanJobActive(scanJobStatus) || isIndexingActive(indexStatus);
}

/**
 * An analysis detail should be polled if its status is active.
 */
export function canPollAnalysisDetail(analysis?: ImpactAnalysisResponse): boolean {
  if (!analysis) return false;

  return isAnalysisActive(analysis.status);
}
