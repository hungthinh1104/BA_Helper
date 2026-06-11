# Impact Analysis Report

## Change Request
Allow users to cancel an order before shipment and automatically release reserved inventory.

## Expected Impacts
- OrderController.cancelOrder
- OrderService.cancelOrder
- InventoryService.releaseReservation
- Order entity
- StockReservation entity

## Unknowns & Clarifications
- Should we refund the user if payment was already captured?
- Is partial cancellation allowed?
- What should happen if inventory release fails?
