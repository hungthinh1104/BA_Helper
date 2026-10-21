/** Curated dev/test output, never an independent accuracy oracle. */
export function createFakeOrderAnalysis(userPrompt: string) {
  return {
    executiveSummary:
      'The current order cancellation flow calls OrderService.cancelOrder and InventoryService.releaseReservation. The required change must ensure stock is released atomically on cancellation. The main risk is partial failure: if inventory release fails after order status update, stock may be permanently locked.',
    insights: [
      {
        insightKey: 'claim:cancel-order-route',
        insightType: 'CLAIM',
        certainty: 'EVIDENCED',
        confidence: 1,
        title: 'Order cancellation endpoint exists.',
        description:
          'OrderController.cancelOrder provides the entrypoint for cancellation.',
        evidenceKeys: ['api:order.controller.cancelOrder'],
      },
      {
        insightKey: 'claim:cancel-order-service',
        insightType: 'CLAIM',
        certainty: 'EVIDENCED',
        confidence: 1,
        title: 'OrderService handles cancellation logic.',
        description:
          'OrderService.cancelOrder contains the business logic for cancelling an order.',
        evidenceKeys: ['service-method:order.service.cancelOrder'],
      },
      {
        insightKey: 'claim:release-inventory',
        insightType: 'CLAIM',
        certainty: 'EVIDENCED',
        confidence: 1,
        title: 'Inventory reservation is released.',
        description:
          'InventoryService.releaseReservation is called to release reserved stock.',
        evidenceKeys: ['service-method:inventory.service.releaseReservation'],
      },
    ].filter(
      (insight) =>
        insight.evidenceKeys.length === 0 ||
        insight.evidenceKeys.some((key) => userPrompt.includes(key)),
    ),
    unknowns: [
      {
        insightKey: 'unknown:refund-payment',
        description: 'Refund or payment behavior is missing.',
        reasoning:
          'No explicit refund or payment artifact was found in the context.',
      },
      {
        insightKey: 'unknown:shipment-boundary',
        description: 'Shipment boundary behavior is missing.',
        reasoning:
          'It is not explicitly confirmed what happens if the order is already shipped.',
      },
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
        description:
          'Reserved inventory is successfully released when cancellation succeeds.',
        priority: 'HIGH',
      },
    ],
  };
}
