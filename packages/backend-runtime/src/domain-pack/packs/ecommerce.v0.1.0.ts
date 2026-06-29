import type { DomainPack } from '@ba-helper/contracts';

export const EcommerceDomainPack: DomainPack = {
  id: 'ecommerce',
  name: 'Ecommerce Order Fulfillment',
  version: '0.1.0',
  status: 'PARTIAL',
  description: 'Partial domain pack for ecommerce order, checkout, inventory reservation, shipment, return/refund, and customer notification workflows.',
  glossaryMetadata: [
    {
      locale: 'en',
      status: 'foundation',
      version: '1.0.0',
      termCount: 8,
    },
    {
      locale: 'vi',
      status: 'foundation',
      version: '1.0.0',
      termCount: 8,
    },
  ],

  concepts: [
    {
      key: 'order',
      label: 'Order',
      aliases: ['order', 'customer order', 'order lifecycle', 'order status'],
      relatedArtifactKeywords: ['order', 'customer-order', 'order-status'],
      relatedKinds: ['SERVICE', 'DATABASE_MODEL', 'API_ENDPOINT'],
    },
    {
      key: 'cart',
      label: 'Cart',
      aliases: ['cart', 'shopping cart', 'cart item', 'basket'],
      relatedArtifactKeywords: ['cart', 'shopping-cart', 'basket'],
      relatedKinds: ['SERVICE', 'DATABASE_MODEL', 'API_ENDPOINT'],
    },
    {
      key: 'checkout',
      label: 'Checkout',
      aliases: ['checkout', 'checkout flow', 'place order', 'order checkout'],
      relatedArtifactKeywords: ['checkout', 'place-order', 'order-checkout'],
      relatedKinds: ['SERVICE', 'API_ENDPOINT'],
    },
    {
      key: 'payment_intent',
      label: 'Payment Intent',
      aliases: ['payment intent', 'payment authorization', 'payment capture', 'payment status'],
      relatedArtifactKeywords: ['payment-intent', 'payment-authorization', 'payment-capture'],
      relatedKinds: ['SERVICE', 'DATABASE_MODEL', 'API_ENDPOINT'],
    },
    {
      key: 'shipment',
      label: 'Shipment',
      aliases: ['shipment', 'shipping', 'ship order', 'delivery'],
      relatedArtifactKeywords: ['shipment', 'shipping', 'ship-order', 'delivery'],
      relatedKinds: ['SERVICE', 'DATABASE_MODEL', 'API_ENDPOINT'],
    },
    {
      key: 'inventory_reservation',
      label: 'Inventory Reservation',
      aliases: ['inventory reservation', 'reserved inventory', 'stock reservation', 'reserve inventory'],
      relatedArtifactKeywords: ['inventory-reservation', 'stock-reservation', 'reserve-inventory'],
      relatedKinds: ['SERVICE', 'DATABASE_MODEL'],
    },
    {
      key: 'return_refund',
      label: 'Return/Refund',
      aliases: ['return refund', 'return', 'refund', 'return request', 'refund request'],
      relatedArtifactKeywords: ['return', 'refund', 'return-request', 'refund-request'],
      relatedKinds: ['SERVICE', 'DATABASE_MODEL', 'API_ENDPOINT'],
    },
    {
      key: 'customer_notification',
      label: 'Customer Notification',
      aliases: ['customer notification', 'order notification', 'shipping notification', 'refund notification'],
      relatedArtifactKeywords: ['customer-notification', 'order-notification', 'shipping-notification'],
      relatedKinds: ['SERVICE', 'API_ENDPOINT'],
    },
  ],

  retrievalHints: [
    'order lifecycle status transition',
    'cart checkout inventory reservation',
    'payment intent authorization capture boundary',
    'shipment status fulfillment workflow',
    'return refund customer notification',
  ],

  riskTemplates: [
    'PARTIAL ecommerce hint: order status and inventory reservation may diverge without source-backed transaction behavior.',
    'PARTIAL ecommerce hint: checkout may reserve inventory before payment intent or order state is settled.',
    'PARTIAL ecommerce hint: shipment transitions may block cancellation or return/refund behavior.',
    'PARTIAL ecommerce hint: this pack does not provide payment compliance, fraud scoring, or tax validation.',
  ],

  qaTemplates: [
    'PARTIAL ecommerce hint: verify order cancellation changes only source-backed order and inventory behavior.',
    'PARTIAL ecommerce hint: verify cart checkout reserves inventory through source-backed checkout/order flow.',
    'PARTIAL ecommerce hint: verify shipment transition effects on inventory reservation and cancellation boundaries.',
  ],

  unknownTemplates: [
    'Which order states allow cancellation after inventory is reserved?',
    'When does checkout reserve inventory relative to payment intent authorization or capture?',
    'Which shipment states block cancellation, return, or refund workflows?',
    'Which customer notifications are required for order, shipment, return, or refund changes?',
    'Are payment compliance, fraud scoring, or tax rules in scope for this ecommerce profile revision?',
  ],
};
