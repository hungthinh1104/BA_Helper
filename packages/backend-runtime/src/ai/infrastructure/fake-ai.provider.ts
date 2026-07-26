import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { LlmProvider, LlmRequest, LlmResult } from '../domain/llm-provider.interface';
import { parseStructuredLlmOutput } from './structured-output';

@Injectable()
export class FakeLlmProvider extends LlmProvider {
  readonly providerName = 'fake';

  async generateStructured<T>(
    request: LlmRequest,
    schema: z.ZodSchema<T>,
  ): Promise<LlmResult<T>> {
    const start = Date.now();
    
    const isOrderInventory = request.userPrompt.includes('InventoryService.releaseReservation') || 
                             request.userPrompt.includes('OrderService.cancelOrder');

    let mockData: any;

    const isBookingRefund = request.userPrompt.includes('booking.controller.cancel') ||
                            request.userPrompt.includes('payment.service.refund') ||
                            request.userPrompt.includes('slot.service.releaseSlot') ||
                            request.userPrompt.includes('notification.service.notifyOwner');

    const isUserOnboarding = request.userPrompt.includes('user.controller.register') ||
                             request.userPrompt.includes('user.controller.verifyEmail') ||
                             request.userPrompt.includes('user.service.registerUser') ||
                             request.userPrompt.includes('user.service.verifyEmail') ||
                             request.userPrompt.includes('user.repository.findByEmail') ||
                             request.userPrompt.includes('email-uniqueness.validator.validate') ||
                             request.userPrompt.includes('welcome-email.service.sendWelcomeEmail') ||
                             request.userPrompt.includes('user-registered.handler.handleUserRegistered');

    if (isOrderInventory) {
      mockData = {
        executiveSummary: 'The current order cancellation flow calls OrderService.cancelOrder and InventoryService.releaseReservation. The required change must ensure stock is released atomically on cancellation. The main risk is partial failure: if inventory release fails after order status update, stock may be permanently locked.',
        insights: [
          {
            insightKey: 'claim:cancel-order-route',
            insightType: 'CLAIM',
            certainty: 'EVIDENCED',
            confidence: 1,
            title: 'Order cancellation endpoint exists.',
            description: 'OrderController.cancelOrder provides the entrypoint for cancellation.',
            evidenceKeys: ['api:order.controller.cancelOrder'],
          },
          {
            insightKey: 'claim:cancel-order-service',
            insightType: 'CLAIM',
            certainty: 'EVIDENCED',
            confidence: 1,
            title: 'OrderService handles cancellation logic.',
            description: 'OrderService.cancelOrder contains the business logic for cancelling an order.',
            evidenceKeys: ['service-method:order.service.cancelOrder'],
          },
          {
            insightKey: 'claim:release-inventory',
            insightType: 'CLAIM',
            certainty: 'EVIDENCED',
            confidence: 1,
            title: 'Inventory reservation is released.',
            description: 'InventoryService.releaseReservation is called to release reserved stock.',
            evidenceKeys: ['service-method:inventory.service.releaseReservation'],
          }
        ].filter(insight => 
          insight.evidenceKeys.length === 0 || 
          insight.evidenceKeys.some(key => request.userPrompt.includes(key))
        ),
        unknowns: [
          {
            insightKey: 'unknown:refund-payment',
            description: 'Refund or payment behavior is missing.',
            reasoning: 'No explicit refund or payment artifact was found in the context.',
          },
          {
            insightKey: 'unknown:shipment-boundary',
            description: 'Shipment boundary behavior is missing.',
            reasoning: 'It is not explicitly confirmed what happens if the order is already shipped.',
          }
        ],
        qaScenarios: [
          {
            scenarioKey: 'qa:cancel-before-shipment',
            description: 'Verify order can be cancelled before shipment.',
            priority: 'HIGH',
          },
          {
            scenarioKey: 'qa:cancel-after-shipment',
            description: 'Reject cancellation after shipment started.',
            priority: 'HIGH',
          },
          {
            scenarioKey: 'qa:duplicate-cancel',
            description: 'Verify idempotency on duplicate cancel.',
            priority: 'MEDIUM',
          },
          {
            scenarioKey: 'qa:inventory-release-fail',
            description: 'Test inventory release failure handling.',
            priority: 'MEDIUM',
          },
          {
            scenarioKey: 'qa:happy-path-release',
            description: 'Reserved inventory is successfully released when cancellation succeeds.',
            priority: 'HIGH',
          }
        ]
      };
    } else if (isBookingRefund) {
      mockData = {
        executiveSummary: 'The current cancellation flow invokes payment.service.refund and slot.service.releaseSlot. The required change must add ownership and eligibility checks before allowing cancellation. The main risks are: refund policy is not confirmed in evidence, and who may cancel is not enforced at the controller level.',
        insights: [
          {
            insightKey: 'claim:cancel-route',
            insightType: 'CLAIM',
            certainty: 'EVIDENCED',
            confidence: 1,
            title: 'The system exposes an API route for cancelling a booking.',
            description: 'The system exposes an API route for cancelling a booking.',
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
            title: 'Refund policy gap can cause inconsistent cancellation outcomes.',
            description: 'The cancellation path calls refund and releases the slot, but no refund percentage or deadline policy is evidenced.',
            reasoning: 'The risk is contextual: refund and slot release are evidenced, while policy details remain unknown.',
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
            description: 'Should cancellation be limited to the booking owner, staff, or both?',
            reasoning: 'The cancellation route is evidenced, but the authorization policy is not confirmed from the evidence scope.',
            evidenceKeys: ['api:booking.controller.cancel'],
          },
          {
            insightKey: 'ac:cancel-paid-booking-refund',
            insightType: 'ACCEPTANCE_CRITERIA',
            certainty: 'INFERRED',
            confidence: 0.82,
            title: 'Paid booking cancellation should request a refund.',
            description: 'Given a paid booking is cancelled successfully, the system should invoke the refund path and keep the booking cancellation flow reviewable.',
            reasoning: 'The criterion is derived from the change request and contextual code evidence; it is proposed for review, not confirmed current behavior.',
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
            description: 'Verify successful paid booking cancellation triggers the refund operation.',
            reasoning: 'The route and refund service are both in the retrieved evidence scope.',
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
            description: 'Verify duplicate cancellation requests do not issue duplicate refunds.',
            reasoning: 'Refund side effects are evidenced, but idempotency policy needs review.',
            evidenceKeys: ['service-method:payment.service.refund'],
            relatedArtifactKeys: ['service-method:booking.service.cancelBooking'],
            given: 'a paid booking has already been cancelled once',
            when: 'the same cancellation request is submitted again',
            then: 'the system does not issue a second refund and returns a controlled duplicate-state response',
          },
        ].filter(insight => 
          insight.evidenceKeys.length === 0 || 
          insight.evidenceKeys.some(key => request.userPrompt.includes(key))
        ),
        unknowns: [
          {
            insightKey: 'unknown:refund-percentage',
            description: 'Refund percentage is not confirmed from code evidence.',
            reasoning: 'No explicit refund percentage or refund policy artifact was found.',
          },
          {
            insightKey: 'unknown:refund-deadline',
            description: 'Refund deadline is not confirmed from code evidence.',
            reasoning: 'No explicit refund deadline was found in the evidence scope.',
          },
          {
            insightKey: 'unknown:who-may-cancel',
            description: 'Who may cancel a booking is not confirmed from code evidence.',
            reasoning: 'No authorization or role checks were found in the cancellation flow.',
          },
          {
            insightKey: 'unknown:owner-approval',
            description: 'Owner approval requirements are not confirmed from code evidence.',
            reasoning: 'No approval or confirmation step was found in the cancellation flow.',
          },
          {
            insightKey: 'unknown:slot-reopen',
            description: 'Slot re-open policy is not confirmed from code evidence.',
            reasoning: 'Slot release is called, but no policy for rebooking timing was found.',
          },
        ],
        qaScenarios: []
      };
    } else if (isUserOnboarding) {
      mockData = {
        executiveSummary:
          'The onboarding flow registers a user via UserController.register and UserService.registerUser, enforces email uniqueness through EmailUniquenessValidator.validate, persists the account with UserRepository.save, and delivers a welcome email out of band via the user.registered event handler. The main risks are missing rate limiting on registration and unconfirmed verification-token expiry policy.',
        insights: [
          {
            insightKey: 'claim:register-route',
            insightType: 'CLAIM',
            certainty: 'EVIDENCED',
            confidence: 1,
            title: 'A registration API route exists.',
            description: 'UserController.register exposes the registration entrypoint.',
            evidenceKeys: ['api:user.controller.register'],
          },
          {
            insightKey: 'claim:register-service',
            insightType: 'CLAIM',
            certainty: 'EVIDENCED',
            confidence: 1,
            title: 'UserService handles registration logic.',
            description: 'UserService.registerUser orchestrates validation, persistence, and the registered event.',
            evidenceKeys: ['service-method:user.service.registerUser'],
          },
          {
            insightKey: 'claim:validate-email-unique',
            insightType: 'CLAIM',
            certainty: 'EVIDENCED',
            confidence: 1,
            title: 'Email uniqueness is validated during registration.',
            description: 'EmailUniquenessValidator.validate rejects duplicate email registrations.',
            evidenceKeys: ['service-method:email-uniqueness.validator.validate'],
          },
          {
            insightKey: 'claim:persist-user',
            insightType: 'CLAIM',
            certainty: 'EVIDENCED',
            confidence: 1,
            title: 'The new user account is persisted.',
            description: 'UserRepository.save writes the pending user account.',
            evidenceKeys: ['service-method:user.repository.save'],
          },
          {
            insightKey: 'claim:lookup-by-email',
            insightType: 'CLAIM',
            certainty: 'EVIDENCED',
            confidence: 1,
            title: 'Existing accounts are looked up by email.',
            description: 'UserRepository.findByEmail backs the uniqueness check.',
            evidenceKeys: ['service-method:user.repository.findByEmail'],
          },
          {
            insightKey: 'claim:send-welcome',
            insightType: 'CLAIM',
            certainty: 'EVIDENCED',
            confidence: 1,
            title: 'A welcome email is sent on registration.',
            description: 'WelcomeEmailService.sendWelcomeEmail delivers the onboarding welcome email.',
            evidenceKeys: ['service-method:welcome-email.service.sendWelcomeEmail'],
          },
          {
            insightKey: 'claim:registered-event-handler',
            insightType: 'CLAIM',
            certainty: 'EVIDENCED',
            confidence: 1,
            title: 'The registered event triggers onboarding side effects.',
            description: 'UserRegisteredHandler.handleUserRegistered reacts to the user.registered event.',
            evidenceKeys: ['service-method:user-registered.handler.handleUserRegistered'],
          },
          {
            insightKey: 'claim:verify-route',
            insightType: 'CLAIM',
            certainty: 'EVIDENCED',
            confidence: 1,
            title: 'An email verification route exists.',
            description: 'UserController.verifyEmail exposes the verification entrypoint.',
            evidenceKeys: ['api:user.controller.verifyEmail'],
          },
          {
            insightKey: 'claim:verify-service',
            insightType: 'CLAIM',
            certainty: 'EVIDENCED',
            confidence: 1,
            title: 'UserService activates the account on verification.',
            description: 'UserService.verifyEmail moves the account to ACTIVE once the token is confirmed.',
            evidenceKeys: ['service-method:user.service.verifyEmail'],
          },
          {
            insightKey: 'question:token-expiry',
            insightType: 'QUESTION',
            certainty: 'UNKNOWN',
            confidence: null,
            title: 'What is the verification-token expiry policy?',
            description: 'How long a verification token remains valid is not evidenced in the code.',
            reasoning: 'The verification route is evidenced, but no expiry/TTL policy was found.',
            evidenceKeys: ['api:user.controller.verifyEmail'],
          },
          {
            insightKey: 'ac:register-persists-pending-user',
            insightType: 'ACCEPTANCE_CRITERIA',
            certainty: 'INFERRED',
            confidence: 0.82,
            title: 'Registration persists a pending-verification user and sends a welcome email.',
            description: 'Given a unique email, when a user registers, then a PENDING_VERIFICATION account is saved and a welcome email is dispatched.',
            reasoning: 'Derived from the registration change request and the evidenced persistence + email side effects.',
            evidenceKeys: [
              'service-method:user.service.registerUser',
              'service-method:welcome-email.service.sendWelcomeEmail',
            ],
            relatedArtifactKeys: ['service-method:user.repository.save'],
          },
          {
            insightKey: 'qa:duplicate-email-rejected',
            insightType: 'QA_SCENARIO',
            certainty: 'INFERRED',
            confidence: 0.78,
            title: 'Duplicate email registration is rejected.',
            description: 'Verify that registering an already-used email is rejected by the uniqueness validator.',
            reasoning: 'The uniqueness validator and email lookup are both in the evidence scope.',
            evidenceKeys: [
              'service-method:email-uniqueness.validator.validate',
              'service-method:user.repository.findByEmail',
            ],
            given: 'an account already exists for the email',
            when: 'a new registration is submitted with the same email',
            then: 'the registration is rejected with a conflict and no second account is created',
          },
        ].filter(insight =>
          insight.evidenceKeys.length === 0 ||
          insight.evidenceKeys.some(key => request.userPrompt.includes(key))
        ),
        unknowns: [
          {
            insightKey: 'unknown:registration-rate-limit',
            description: 'Registration rate limiting is not confirmed from code evidence.',
            reasoning: 'No throttling or rate-limit guard was found on the registration route.',
          },
          {
            insightKey: 'unknown:verification-token-expiry',
            description: 'Verification token expiry is not confirmed from code evidence.',
            reasoning: 'No token TTL or expiry check was found in the verification flow.',
          },
          {
            insightKey: 'unknown:password-policy',
            description: 'Password strength policy is not confirmed from code evidence.',
            reasoning: 'Registration accepts a pre-hashed password with no evidenced strength policy.',
          },
        ],
        qaScenarios: []
      };
    } else {
      mockData = {
        executiveSummary: 'The specific behavior for this change request is not confirmed from the provided evidence. Evidence coverage is insufficient to determine primary impacts; manual inspection is required.',
        insights: [],
        unknowns: [
          {
            insightKey: 'unknown:generic-behavior',
            description: 'Specific behavior is not confirmed from code evidence.',
            reasoning: 'No explicit implementation was found in the provided evidence.',
          }
        ],
        qaScenarios: []
      };
    }

    const rawText = JSON.stringify(mockData);

    const { data, parseMode, rawLength, jsonLength } = parseStructuredLlmOutput({
      rawText,
      schema,
      allowJsonExtraction: false,
    });
    
    return {
      data,
      metadata: {
        provider: 'fake',
        model: 'fake-deterministic',
        promptVersion: 'test',
        durationMs: Date.now() - start,
        parseMode,
        rawLength,
        jsonLength,
      },
    };
  }
}
