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

@Injectable()
export class FakeLlmProvider extends LlmProvider {
  readonly providerName = 'fake';

  async generateStructured<T>(
    request: LlmRequest,
    schema: z.ZodSchema<T>,
  ): Promise<LlmResult<T>> {
    const start = Date.now();

    const isOrderInventory =
      request.userPrompt.includes('InventoryService.releaseReservation') ||
      request.userPrompt.includes('OrderService.cancelOrder');

    let mockData: any;

    const isBookingRefund =
      request.userPrompt.includes('booking.controller.cancel') ||
      request.userPrompt.includes('payment.service.refund') ||
      request.userPrompt.includes('slot.service.releaseSlot') ||
      request.userPrompt.includes('notification.service.notifyOwner');

    const isUserOnboarding =
      request.userPrompt.includes('user.controller.register') ||
      request.userPrompt.includes('user.controller.verifyEmail') ||
      request.userPrompt.includes('user.service.registerUser') ||
      request.userPrompt.includes('user.service.verifyEmail') ||
      request.userPrompt.includes('user.repository.findByEmail') ||
      request.userPrompt.includes('email-uniqueness.validator.validate') ||
      request.userPrompt.includes('welcome-email.service.sendWelcomeEmail') ||
      request.userPrompt.includes(
        'user-registered.handler.handleUserRegistered',
      );

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

    mockData.insights = scopeFakeClaims(request.userPrompt, mockData.insights);
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
