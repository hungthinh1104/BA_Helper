# Sample Requirement Change

This is the canonical golden path requirement used for testing the Requirement-to-Code Impact Analyzer. Use this to simulate a real-world change against the `nestjs-booking-with-payment` fixture or a similar public repository.

## Scenario
A business analyst is requesting that the existing booking cancellation logic be enhanced to securely process refunds, rather than simply marking a booking as cancelled. 

## Requirement Text

```text
When a paid booking is cancelled, the system must refund the tenant, prevent double refunds, update booking/payment state, and notify relevant parties.
```

## Recommended Input Settings

- **Repository:** `booking` (or whatever you named the local fixture sync)
- **Branch:** `main`
- **Domain Pack:** `booking@0.1.0`

## Expected Outputs in UI
1. **Impacted Artifacts:** You should see `BookingController`, `BookingService`, and `PaymentService` flagged as directly impacted.
2. **Evidence:** Each artifact must display real code snippets backing the impact claim.
3. **Risks/QA:** You should expect to see surfaced unknowns such as "What happens if the refund fails?" or "Are partial refunds allowed?".
4. **Final Report:** Upon marking all items as reviewed, the exported document should contain a traceability matrix proving your due diligence on this ticket.
