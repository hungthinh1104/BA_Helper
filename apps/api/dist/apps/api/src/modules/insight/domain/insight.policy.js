"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InsightPolicy = void 0;
const app_error_1 = require("../../../shared/app-error");
exports.InsightPolicy = {
    validateInsight: (insight) => {
        if (insight.certainty === 'EVIDENCED' && insight.evidenceCount === 0) {
            throw new app_error_1.AppError('INVALID_INSIGHT_CERTAINTY', 'An EVIDENCED insight must link to at least one persisted Evidence record.');
        }
    },
};
