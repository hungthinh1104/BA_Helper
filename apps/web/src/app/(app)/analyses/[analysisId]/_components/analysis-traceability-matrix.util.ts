import type { InsightListResponse } from '@ba-helper/contracts';

type Insight = InsightListResponse['items'][number];
type TraceType =
  | "EVIDENCE_BACKED_IMPACT"
  | "INFERRED_IMPACT"
  | "DIAGNOSTIC_DERIVED_RISK"
  | "QA_COVERAGE"
  | "OPEN_QUESTION"
type RowKind = "traceability_link" | "insight" | "qa_scenario" | "diagnostic_risk" | "open_question"

export function classifyInsight(insight: Insight): { traceType: TraceType; sourceKind: RowKind } | null {
  if (insight.category === "QA_SCENARIO") {
    return { traceType: "QA_COVERAGE", sourceKind: "qa_scenario" }
  } else if (insight.category === "QUESTION") {
    return { traceType: "OPEN_QUESTION", sourceKind: "open_question" }
  } else if (insight.category === "UNKNOWN") {
    const meta = (insight as unknown as Record<string, unknown>)?.metadata as Record<string, unknown> | undefined
    const hasDiagnostic = !!meta?.diagnostic || !!meta?.diagnosticCode
    
    if (hasDiagnostic) {
      return { traceType: "DIAGNOSTIC_DERIVED_RISK", sourceKind: "diagnostic_risk" }
    } else {
      return { traceType: "INFERRED_IMPACT", sourceKind: "insight" }
    }
  } else if (insight.category === "CLAIM") {
    const traceType: TraceType = insight.certainty === "EVIDENCED" ? "EVIDENCE_BACKED_IMPACT" : "INFERRED_IMPACT"
    const sourceKind: RowKind = "insight"
    
    return { traceType, sourceKind }
  }
  return null
}
