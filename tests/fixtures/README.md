# Fixture Index

Do not mutate shared fixtures casually. Treat these as stable inputs for analyzer, retrieval, and API tests.

## Core fixture sets

| Fixture | Purpose | Commonly used by | Notes |
|---|---|---|---|
| `nestjs-booking-with-payment/` | Primary MVP fixture for booking, payment, refund, review, and derived analysis flows | `tests/analyzer/*`, `tests/impact-analysis/*`, `tests/embedding/*`, API/e2e fixture-based tests | Best default fixture for end-to-end MVP behavior. Keep expected outputs in sync with analyzer changes. |
| `nestjs-booking-unconnected-refund/` | Negative / partial fixture for missing linkage and unknown impacts | analyzer and retrieval tests that verify missing evidence or unconnected flow handling | Use when you need deliberate gaps, unknowns, or unsupported edge paths. |
| `nestjs-order-inventory/` | Legacy comparative fixture for order/inventory impact and retrieval behavior | analyzer, retrieval, benchmark-style tests | Useful for comparison and regression checks, but not the primary BA_helper MVP slice. |
| `express-unsupported/` | Unsupported framework fixture | analyzer and framework-detection tests | Use to verify unsupported-framework rejection behavior. |

## When to use what

- Use `nestjs-booking-with-payment/` first for most MVP work.
- Use `nestjs-booking-unconnected-refund/` when you need partial coverage or missing links.
- Use `nestjs-order-inventory/` only for comparative or regression scenarios outside the main booking/refund slice.
- Use `express-unsupported/` only for framework rejection coverage.

## Rule

If a fixture needs changing, update the expected outputs and the tests that depend on it in the same change. Shared fixtures are part of the test contract.
