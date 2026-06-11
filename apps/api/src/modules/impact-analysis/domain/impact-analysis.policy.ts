export const ImpactAnalysisPolicy = {
  canAnalyzeSnapshot: (params: {
    coverageStatus: 'READY' | 'PARTIAL';
    allowPartialSnapshot: boolean;
  }) => {
    if (params.coverageStatus === 'PARTIAL' && !params.allowPartialSnapshot) {
      return false;
    }
    return true;
  },
  canFinalize: (params: { status: 'WAITING_FOR_REVIEW' | string; isStale: boolean }) => {
    return params.status === 'WAITING_FOR_REVIEW' && !params.isStale;
  },
  validateLifecycleState: (currentState: string, event: 'REVIEW' | 'FINALIZE' | 'CANCEL') => {
    switch (event) {
      case 'REVIEW':
        return currentState === 'WAITING_FOR_REVIEW';
      case 'FINALIZE':
        return currentState === 'WAITING_FOR_REVIEW';
      case 'CANCEL':
        return currentState === 'PROCESSING';
      default:
        return false;
    }
  },
};
