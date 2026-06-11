"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ScanJobPolicy = void 0;
const app_error_1 = require("../../../shared/app-error");
exports.ScanJobPolicy = {
    validateRef: (ref) => {
        if (!ref)
            return;
        if (ref.includes(' ') || ref.includes('..') || ref.includes('~')) {
            throw new app_error_1.AppError('INVALID_REPOSITORY_REF', 'Repository ref is invalid.');
        }
    },
    validateIdempotentRetry: (existingJobStatus) => {
        if (existingJobStatus === 'COMPLETED' || existingJobStatus === 'FAILED') {
            return { canReuse: true };
        }
        // If it is QUEUED or PROCESSING, we also return the existing one
        return { canReuse: true };
    },
};
