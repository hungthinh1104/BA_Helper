"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ImpactAnalysisPolicy = void 0;
exports.ImpactAnalysisPolicy = {
    canAnalyzeSnapshot: (params) => {
        if (params.coverageStatus === 'PARTIAL' && !params.allowPartialSnapshot) {
            return false;
        }
        return true;
    },
    canFinalize: (params) => {
        return params.status === 'WAITING_FOR_REVIEW' && !params.isStale;
    },
    validateLifecycleState: (currentState, event) => {
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
