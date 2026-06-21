# BA Helper: Recommended Demo Scenario

This document defines the standard requirement change scenario used for demonstrating BA Helper's audited impact analysis workflow.

## 1. The Requirement Change
**Input Text:**
> "When a booking is cancelled after payment, the system must release room inventory, mark the booking as cancelled, and prevent duplicate refund requests."

**Why this scenario is effective:**
- It is easy for technical and non-technical reviewers to understand.
- It is backend-heavy and involves state transitions.
- It carries a clear risk of QA regressions (e.g., duplicate refunds, stranded inventory).
- It clearly demonstrates traceability across multiple bounded contexts (Booking, Inventory, Billing/Refund).

## 2. Expected Impacted Artifacts
Depending on the analyzed repository structure, the expected impacted backend artifacts for this demo include:
- `BookingService` (or equivalent booking state management module)
- `InventoryService` (or equivalent room release module)
- `RefundController` (or equivalent billing/refund API)

*Note: These specific names are representative. The actual artifacts extracted depend entirely on the provided repository snapshot (e.g., `nestjs-booking-with-payment`).*

## 3. Demo Evidence and Traceability

During the demo, the system will expose the following layers:

### A. Traceability Evidence
When inspecting an impacted artifact (like `BookingService`), the Evidence Quality Table will display specific code excerpts proving why the artifact was flagged.
- Example: `booking.service.ts: L45-60` highlighting the `cancelBooking()` method.

### B. Unknowns / Risk Scenarios
The analysis will flag potential blind spots where the LLM could not find concrete evidence.
- Example: "Could not locate explicit logic preventing duplicate refunds. Risk of double-payout if cancel is called twice."

### C. QA Scenarios
The system will generate targeted acceptance criteria based on the codebase constraints.
- Example: "Verify that calling `POST /api/bookings/:id/cancel` on an already refunded booking returns HTTP 400."

## 4. The Human Review Process
In the demo, the analyst will manually review these extracted links:
- The link to `InventoryService` is marked `ACCEPTED`.
- A hallucinated link to an unrelated `NotificationController` is marked `REJECTED`.
- The missing duplicate-refund check is marked `NEEDS_MORE_EVIDENCE`.

This strict review phase visually proves that the system does not allow AI output to bypass human verification.
