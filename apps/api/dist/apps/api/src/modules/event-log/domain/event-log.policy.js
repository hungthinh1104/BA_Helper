"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EventLogPolicy = void 0;
exports.EventLogPolicy = {
    validateIdempotencyKey: () => {
        // TODO: enforce unique idempotency keys for retryable events.
    },
};
