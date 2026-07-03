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
