# Phase 6A — Gemini Smoke Quality Rubric

**Purpose**: Manual quality gate for the first real Gemini LLM smoke run.
Run this after `REAL_PATH_SMOKE=true tsx src/smoke-e2e.ts` passes all automated assertions.

---

## Automated gates (must pass before manual review)

These are enforced by `smoke-e2e.ts` when `AI_PROVIDER=google`:

```
✅ analysis.status = WAITING_FOR_REVIEW or COMPLETED
✅ llm.provider = google (not fake/unknown)
✅ llm.model contains "gemini"
✅ llm.parseMode = raw
✅ llm.promptVersion is set (not empty)
✅ llm.inputTokens > 0
✅ vector.indexStatus = VECTOR_READY
✅ schema valid (Zod parse passed)
✅ evidenceKeys valid (no invented artifact keys)
```

---

## Manual review checklist

### 1. Provider metadata block (smoke JSON output)

Open `docs/runbooks/public-github-smoke-real-path-output.json` and verify:

```json
"llm": {
  "provider": "google",
  "model": "gemini-2.5-flash",
  "promptVersion": "2.0.0",
  "parseMode": "raw",
  "inputTokens": "> 0",
  "outputTokens": "> 0"
}
```

- [ ] `provider` = `"google"`, not `"fake"`
- [ ] `model` = `"gemini-2.5-flash"` (matches `GEMINI_MODEL` env)
- [ ] `promptVersion` = `"2.0.0"` (matches `PROMPTS.IMPACT_ANALYSIS.version`)
- [ ] `parseMode` = `"raw"` — if `"extracted"`, flag as warning and investigate
- [ ] `inputTokens` > 0
- [ ] `outputTokens` > 0

---

### 2. Insights quality

Open the analysis in the UI or read from the report JSON.

**EVIDENCED insights:**
- [ ] Each has a specific, non-generic title (not "Impact on system" or "Code change detected")
- [ ] `evidenceKeys` reference real artifact keys from the snapshot (e.g., `api:booking.controller.cancel`)
- [ ] No refund/payment rule stated as EVIDENCED unless explicit payment evidence exists

**UNKNOWN items:**
- [ ] Each explains *what specific evidence is missing* (not just "no information available")
- [ ] No refund/payment/partial-cancel policy invented as EVIDENCED
- [ ] Expected UNKNOWNs for booking domain:
  - Refund policy (partial vs full)
  - Inventory release failure behavior
  - Notification guarantees

> [!IMPORTANT]
> **Hard fail**: Any EVIDENCED insight with empty or invalid `evidenceKeys` → schema drift or hallucination.
> **Hard fail**: Any EVIDENCED insight asserting refund/payment policy without payment artifact evidence.

---

### 3. QA scenarios quality

- [ ] At least 3 QA scenarios present
- [ ] Scenarios are testable (specific action + expected outcome)
- [ ] Covers at minimum: happy path cancel, failure path (slot release failure), idempotency
- [ ] No trivially generic scenarios like "Test that the system works"

---

### 4. Report readability

Open the report in the UI (`/reports` page) and read as a non-technical BA:

- [ ] Section headers present and logical
- [ ] Insights are written in business language, not raw code references
- [ ] UNKNOWN items formatted as open questions, not cryptic error messages
- [ ] QA scenarios phrased as testable scenarios, not code-level assertions

---

### 5. Hallucination check

Review the report for invented information:

- [ ] No invented business rules (e.g., "System charges 10% cancellation fee") that have no evidence
- [ ] No cross-domain claims (e.g., "affects shipping module") without evidence
- [ ] No claims referencing artifacts not in the evidence pack

---

## Scoring

| Score | Meaning |
|---|---|
| All hard fails clear + ≥ 80% of manual checks pass | **Phase 6A Pass** → proceed to 6B |
| Hard fails clear + 50–79% manual checks | **6A-Warn** → review prompt, may need minor tuning |
| Any hard fail | **6A-Fail** → do not finalize baseline, investigate |

---

## If 6A fails: 6A-R protocol

```
1. Save raw Gemini output JSON for analysis.
2. Identify fail category:
   - Schema invalid → check responseMimeType, consider schema simplification
   - EvidenceKeys hallucinated → tighten EVIDENCE CONTRACT in prompt
   - EVIDENCED without evidence → strengthen UNKNOWN CONTRACT
   - UNKNOWNs too generic → add domain specifics to prompt
3. Fix ONE thing at a time.
4. Re-run smoke.
5. Do not compare OpenAI until Gemini baseline is stable.
```

---

## Sign-off

```
Date: ___________
Smoke output file: public-github-smoke-real-path-output.json
Manual reviewer: ___________
Result: PASS / WARN / FAIL
Notes: ___________
```
