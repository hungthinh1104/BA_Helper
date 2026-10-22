/** Curated dev/test output, never an independent accuracy oracle. */
export function createFakeBookingAnalysis(userPrompt: string) {
  return {
    executiveSummary:
      'The current cancellation flow invokes payment.service.refund and slot.service.releaseSlot. The required change must add ownership and eligibility checks before allowing cancellation. The main risks are: refund policy is not confirmed in evidence, and who may cancel is not enforced at the controller level.',
    insights: [
      {
        insightKey: 'claim:cancel-route',
        insightType: 'CLAIM',
        certainty: 'EVIDENCED',
        confidence: 1,
        title: 'The system exposes an API route for cancelling a booking.',
        description:
          'The system exposes an API route for cancelling a booking.',
        evidenceKeys: ['api:booking.controller.cancel'],
      },
      {
        insightKey: 'claim:cancel-refund',
        insightType: 'CLAIM',
        certainty: 'EVIDENCED',
        confidence: 1,
        title: 'Cancellation triggers a refund operation.',
        description: 'Cancellation triggers a refund operation.',
        evidenceKeys: ['service-method:payment.service.refund'],
      },
      {
        insightKey: 'claim:release-slot',
        insightType: 'CLAIM',
        certainty: 'EVIDENCED',
        confidence: 1,
        title: 'Cancellation releases the booked slot.',
        description: 'Cancellation releases the booked slot.',
        evidenceKeys: ['service-method:slot.service.releaseSlot'],
      },
      {
        insightKey: 'claim:notify-owner',
        insightType: 'CLAIM',
        certainty: 'EVIDENCED',
        confidence: 1,
        title: 'Cancellation notifies the booking owner.',
        description: 'Cancellation notifies the booking owner.',
        evidenceKeys: ['service-method:notification.service.notifyOwner'],
      },
      {
        insightKey: 'risk:refund-policy-gap',
        insightType: 'CLAIM',
        certainty: 'INFERRED',
        confidence: 0.72,
        title:
          'Refund policy gap can cause inconsistent cancellation outcomes.',
        description:
          'The cancellation path calls refund and releases the slot, but no refund percentage or deadline policy is evidenced.',
        reasoning:
          'The risk is contextual: refund and slot release are evidenced, while policy details remain unknown.',
        evidenceKeys: [
          'service-method:payment.service.refund',
          'service-method:slot.service.releaseSlot',
        ],
        relatedArtifactKeys: ['service-method:booking.service.cancelBooking'],
        kind: 'risk',
        severity: 'HIGH',
        category: 'refund-policy',
      },
      {
        insightKey: 'question:who-may-cancel',
        insightType: 'QUESTION',
        certainty: 'UNKNOWN',
        confidence: null,
        title: 'Who is allowed to cancel a paid booking?',
        description:
          'Should cancellation be limited to the booking owner, staff, or both?',
        reasoning:
          'The cancellation route is evidenced, but the authorization policy is not confirmed from the evidence scope.',
        evidenceKeys: ['api:booking.controller.cancel'],
      },
      {
        insightKey: 'ac:cancel-paid-booking-refund',
        insightType: 'ACCEPTANCE_CRITERIA',
        certainty: 'INFERRED',
        confidence: 0.82,
        title: 'Paid booking cancellation should request a refund.',
        description:
          'Given a paid booking is cancelled successfully, the system should invoke the refund path and keep the booking cancellation flow reviewable.',
        reasoning:
          'The criterion is derived from the change request and contextual code evidence; it is proposed for review, not confirmed current behavior.',
        evidenceKeys: [
          'api:booking.controller.cancel',
          'service-method:payment.service.refund',
        ],
        relatedArtifactKeys: ['service-method:booking.service.cancelBooking'],
      },
      {
        insightKey: 'qa:cancel-paid-booking-refunds-payment',
        insightType: 'QA_SCENARIO',
        certainty: 'INFERRED',
        confidence: 0.78,
        title: 'Cancel paid booking triggers refund.',
        description:
          'Verify successful paid booking cancellation triggers the refund operation.',
        reasoning:
          'The route and refund service are both in the retrieved evidence scope.',
        evidenceKeys: [
          'api:booking.controller.cancel',
          'service-method:payment.service.refund',
        ],
        relatedArtifactKeys: ['service-method:booking.service.cancelBooking'],
        given: 'a paid booking exists and is eligible for cancellation',
        when: 'the authorized actor cancels the booking',
        then: 'the cancellation flow invokes the refund operation and returns a successful response',
      },
      {
        insightKey: 'qa:duplicate-cancel-does-not-double-refund',
        insightType: 'QA_SCENARIO',
        certainty: 'INFERRED',
        confidence: 0.7,
        title: 'Duplicate cancellation does not double refund.',
        description:
          'Verify duplicate cancellation requests do not issue duplicate refunds.',
        reasoning:
          'Refund side effects are evidenced, but idempotency policy needs review.',
        evidenceKeys: ['service-method:payment.service.refund'],
        relatedArtifactKeys: ['service-method:booking.service.cancelBooking'],
        given: 'a paid booking has already been cancelled once',
        when: 'the same cancellation request is submitted again',
        then: 'the system does not issue a second refund and returns a controlled duplicate-state response',
      },
    ].filter(
      (insight) =>
        userPrompt.includes('[EVIDENCE ') ||
        insight.evidenceKeys.length === 0 ||
        insight.evidenceKeys.some((key) => userPrompt.includes(key)),
    ),
    unknowns: [
      {
        insightKey: 'unknown:refund-percentage',
        description: 'Refund percentage is not confirmed from code evidence.',
        reasoning:
          'No explicit refund percentage or refund policy artifact was found.',
      },
      {
        insightKey: 'unknown:refund-deadline',
        description: 'Refund deadline is not confirmed from code evidence.',
        reasoning:
          'No explicit refund deadline was found in the evidence scope.',
      },
      {
        insightKey: 'unknown:who-may-cancel',
        description:
          'Who may cancel a booking is not confirmed from code evidence.',
        reasoning:
          'No authorization or role checks were found in the cancellation flow.',
      },
      {
        insightKey: 'unknown:owner-approval',
        description:
          'Owner approval requirements are not confirmed from code evidence.',
        reasoning:
          'No approval or confirmation step was found in the cancellation flow.',
      },
      {
        insightKey: 'unknown:slot-reopen',
        description: 'Slot re-open policy is not confirmed from code evidence.',
        reasoning:
          'Slot release is called, but no policy for rebooking timing was found.',
      },
    ],
    qaScenarios: [],
  };
}
