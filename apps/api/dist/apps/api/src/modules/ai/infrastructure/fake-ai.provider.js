"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FakeAiProvider = void 0;
class FakeAiProvider {
    async analyze() {
        return {
            insights: [
                {
                    insightKey: 'claim:cancel-route',
                    description: 'The system exposes an API route for cancelling a booking.',
                    certainty: 'EVIDENCED',
                    evidenceIds: [],
                },
                {
                    insightKey: 'claim:cancel-refund',
                    description: 'Cancellation triggers a refund operation.',
                    certainty: 'EVIDENCED',
                    evidenceIds: [],
                },
                {
                    insightKey: 'claim:release-slot',
                    description: 'Cancellation releases the booked slot.',
                    certainty: 'EVIDENCED',
                    evidenceIds: [],
                },
                {
                    insightKey: 'claim:notify-owner',
                    description: 'Cancellation notifies the booking owner.',
                    certainty: 'EVIDENCED',
                    evidenceIds: [],
                },
                {
                    insightKey: 'unknown:refund-percentage',
                    description: 'Refund percentage is not confirmed from code evidence.',
                    certainty: 'UNKNOWN',
                    evidenceIds: [],
                },
                {
                    insightKey: 'unknown:refund-deadline',
                    description: 'Refund deadline is not confirmed from code evidence.',
                    certainty: 'UNKNOWN',
                    evidenceIds: [],
                },
                {
                    insightKey: 'unknown:who-may-cancel',
                    description: 'Who may cancel a booking is not confirmed from code evidence.',
                    certainty: 'UNKNOWN',
                    evidenceIds: [],
                },
                {
                    insightKey: 'unknown:owner-approval',
                    description: 'Owner approval requirements are not confirmed from code evidence.',
                    certainty: 'UNKNOWN',
                    evidenceIds: [],
                },
                {
                    insightKey: 'unknown:slot-reopen',
                    description: 'Slot re-open policy is not confirmed from code evidence.',
                    certainty: 'UNKNOWN',
                    evidenceIds: [],
                },
            ],
        };
    }
}
exports.FakeAiProvider = FakeAiProvider;
