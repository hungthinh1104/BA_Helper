import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { LlmProvider, LlmRequest, LlmResult } from '../domain/llm-provider.interface';

@Injectable()
export class FakeLlmProvider extends LlmProvider {
  readonly providerName = 'fake';

  async generateStructured<T>(
    request: LlmRequest,
    schema: z.ZodSchema<T>,
  ): Promise<LlmResult<T>> {
    const start = Date.now();
    
    // Default payload for testing impact analysis
    const mockData: any = {
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
    };

    const data = schema.parse(mockData);
    
    return {
      data,
      metadata: {
        provider: 'fake',
        model: 'fake-deterministic',
        promptVersion: 'test',
        durationMs: Date.now() - start,
      },
    };
  }
}
