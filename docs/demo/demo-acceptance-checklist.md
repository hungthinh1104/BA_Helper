# BA Helper: Demo Acceptance Checklist

Once you have successfully followed the [Local Demo Runbook](./run-local-demo.md), you can use this checklist to experience the audited traceability workflow as a reviewer.

## Scenario A: The Human Review Flow

Select **Scenario A (WAITING_FOR_REVIEW)** from the Analysis list.

### 1. Analysis Workspace Validation
- [ ] The Analysis Workspace opens without errors.
- [ ] The raw requirement text ("When a booking is cancelled after payment...") is visible.
- [ ] Three impacted backend artifacts are listed: `BookingService`, `RefundController`, and `InventoryService`.
- [ ] "Review Progress" shows 0/3 (or similar incomplete state).

### 2. Evidence Inspection
- [ ] Click on an impacted artifact (e.g., `BookingService`).
- [ ] The Evidence Inspector opens.
- [ ] The Evidence Quality Table displays the exact synthetic code excerpt proving the impact (e.g., `booking.service.ts: L45-60`).

### 3. Review Decisions
- [ ] Navigate to the Review Decisions panel.
- [ ] Set `BookingService` to **ACCEPTED**.
- [ ] Set `RefundController` to **ACCEPTED**.
- [ ] Set `InventoryService` to **NEEDS_MORE_EVIDENCE** (or explicitly **ACCEPTED**).
- [ ] Confirm the progress bar advances.

### 4. Final Review Gate (Blocked)
- [ ] Open the Final Review Gate panel.
- [ ] Confirm that if there are any `NEEDS_REVIEW` links left, the "Take Snapshot" and "Download .md" buttons are appropriately blocked or disabled.

### 5. Snapshot Creation
- [ ] Once all links have decisions, click **Take Snapshot**.
- [ ] A success message should appear.
- [ ] The Final Review Gate should now show 100% complete and unlock the export options.

---

## Scenario B: The Final Export Flow

Select **Scenario B (COMPLETED)** from the Analysis list.

### 6. The Final Reviewed Report
- [ ] The Final Review Gate is fully unblocked (100% complete).
- [ ] Click **View Final Reviewed Report**.
- [ ] A read-only Markdown viewer appears.
- [ ] The Markdown content strictly reflects the locked snapshot decisions (e.g., 2 ACCEPTED, 1 REJECTED).

### 7. Markdown Download
- [ ] Click **Download .md**.
- [ ] Your browser downloads a markdown file named similarly to `final-reviewed-report-<id>-<snapshot>.md`.
- [ ] Open the file locally to confirm the synthetic payload is preserved deterministically offline.
