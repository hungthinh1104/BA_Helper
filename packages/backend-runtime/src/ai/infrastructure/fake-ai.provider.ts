import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import {
  LlmProvider,
  LlmRequest,
  LlmResult,
} from '../domain/llm-provider.interface';
import { parseStructuredLlmOutput } from './structured-output';
import { createFakeOrderAnalysis } from './fake-order-analysis';
import { createFakeBookingAnalysis } from './fake-booking-analysis';
import { createFakeOnboardingAnalysis } from './fake-onboarding-analysis';
import { scopeFakeClaims } from './fake-claim-scope';
import { bindFakeClaimsToEvidence, hasEvidenceSymbol } from './fake-evidence-binding';

@Injectable()
export class FakeLlmProvider extends LlmProvider {
  readonly providerName = 'fake';

  async generateStructured<T>(
    request: LlmRequest,
    schema: z.ZodSchema<T>,
  ): Promise<LlmResult<T>> {
    const start = Date.now();

    const isOrderInventory =
      hasEvidenceSymbol(request.userPrompt, 'InventoryService.releaseReservation') ||
      hasEvidenceSymbol(request.userPrompt, 'OrderService.cancelOrder') ||
      request.userPrompt.includes('order.controller.cancelOrder') ||
      request.userPrompt.includes('order.service.cancelOrder');

    let mockData: any;

    const isBookingRefund =
      hasEvidenceSymbol(request.userPrompt, 'BookingController.cancel') ||
      hasEvidenceSymbol(request.userPrompt, 'PaymentService.refund') ||
      hasEvidenceSymbol(request.userPrompt, 'SlotService.releaseSlot') ||
      hasEvidenceSymbol(request.userPrompt, 'NotificationService.notifyOwner') ||
      request.userPrompt.includes('booking.controller.cancel') ||
      request.userPrompt.includes('payment.service.refund') ||
      request.userPrompt.includes('slot.service.releaseSlot') ||
      request.userPrompt.includes('notification.service.notifyOwner');

    const isUserOnboarding = [
      'UserController.register', 'UserController.verifyEmail', 'UserService.registerUser',
      'UserService.verifyEmail', 'UserRepository.findByEmail', 'EmailUniquenessValidator.validate',
      'WelcomeEmailService.sendWelcomeEmail', 'UserRegisteredHandler.handleUserRegistered',
    ].some(symbol => hasEvidenceSymbol(request.userPrompt, symbol)) ||
      ['user.controller.register', 'user.controller.verifyEmail', 'user.service.registerUser',
        'user.service.verifyEmail', 'user.repository.findByEmail', 'email-uniqueness.validator.validate',
        'welcome-email.service.sendWelcomeEmail', 'user-registered.handler.handleUserRegistered']
        .some(key => request.userPrompt.includes(key));

    if (isOrderInventory) {
      mockData = createFakeOrderAnalysis(request.userPrompt);
    } else if (isBookingRefund) {
      mockData = createFakeBookingAnalysis(request.userPrompt);
    } else if (isUserOnboarding) {
      mockData = createFakeOnboardingAnalysis(request.userPrompt);
    } else {
      mockData = {
        executiveSummary:
          'The specific behavior for this change request is not confirmed from the provided evidence. Evidence coverage is insufficient to determine primary impacts; manual inspection is required.',
        insights: [],
        unknowns: [
          {
            insightKey: 'unknown:generic-behavior',
            description:
              'Specific behavior is not confirmed from code evidence.',
            reasoning:
              'No explicit implementation was found in the provided evidence.',
          },
        ],
        qaScenarios: [],
      };
    }

    mockData.insights = scopeFakeClaims(request.userPrompt,
      bindFakeClaimsToEvidence(request.userPrompt, mockData.insights));
    const rawText = JSON.stringify(mockData);

    const { data, parseMode, rawLength, jsonLength } = parseStructuredLlmOutput(
      {
        rawText,
        schema,
        allowJsonExtraction: false,
      },
    );

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
