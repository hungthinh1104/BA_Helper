import { BenchmarkFailureClass, BenchmarkMismatch, BenchmarkReport } from './benchmark-types';
import type { ScanArtifact } from '../../packages/analyzer/src/scanner/scanner.types';

export interface MinimumImpactConfig {
  requiredEvidenced: { concept: string; mustReferenceAny: string[] }[];
  requiredUnknowns: { concept: string; mustReferenceAny: string[] }[];
  requiredQaScenarios: { concept: string; mustReferenceAny: string[] }[];
  hallucinationTriggers: { concept: string; mustReferenceAny: string[] }[];
}

export const evaluateLlmImpact = (
  fixtureName: string,
  provider: string,
  changeRequest: string,
  llmOutput: any, // The structured AI output
  retrievedContext: ScanArtifact[],
  expectedMinimum: MinimumImpactConfig
): BenchmarkReport => {
  const mismatches: BenchmarkMismatch[] = [];
  const validEvidenceKeys = new Set(retrievedContext.map(a => a.stableId));

  // Helper to check semantic match
  const matchesAny = (text: string, keywords: string[]) => {
    const lowerText = text.toLowerCase();
    return keywords.some(kw => lowerText.includes(kw.toLowerCase()));
  };

  // 1. Evidence Grounding Check (EVIDENCED claims MUST have valid evidenceKeys)
  const evidencedClaims = llmOutput.insights?.filter((i: any) => i.certainty === 'EVIDENCED' || i.insightType === 'CLAIM') || [];
  
  for (const claim of evidencedClaims) {
    if (!claim.evidenceKeys || claim.evidenceKeys.length === 0) {
      mismatches.push({
        failureClass: BenchmarkFailureClass.EVIDENCE_GROUNDING_VIOLATION,
        expected: '1 or more evidenceKeys',
        actual: '0 evidenceKeys',
        details: `EVIDENCED claim "${claim.title || claim.insightKey}" is missing evidence.`
      });
    } else {
      for (const key of claim.evidenceKeys) {
        if (!validEvidenceKeys.has(key)) {
          mismatches.push({
            failureClass: BenchmarkFailureClass.EVIDENCE_GROUNDING_VIOLATION,
            expected: 'valid evidence key from retrieved context',
            actual: key,
            details: `EVIDENCED claim "${claim.title || claim.insightKey}" cites an invalid or unretrieved evidence key: ${key}.`
          });
        }
      }
    }
  }

  // 2. Check for Hallucinations
  // We check if any EVIDENCED claim mentions a hallucination trigger
  for (const claim of evidencedClaims) {
    const fullText = `${claim.title || ''} ${claim.description || ''}`;
    for (const trigger of expectedMinimum.hallucinationTriggers) {
      if (matchesAny(fullText, trigger.mustReferenceAny)) {
        mismatches.push({
          failureClass: BenchmarkFailureClass.AI_HALLUCINATION,
          expected: 'No mention of unsupported concept as EVIDENCED fact',
          actual: `Claim mentioned: ${trigger.concept}`,
          details: `AI hallucinated unsupported concept "${trigger.concept}" in EVIDENCED claim: "${claim.title || claim.insightKey}"`
        });
      }
    }
  }

  // 3. Check Required Evidenced Impacts
  for (const req of expectedMinimum.requiredEvidenced) {
    const found = evidencedClaims.some((claim: any) => {
      const fullText = `${claim.title || ''} ${claim.description || ''} ${(claim.evidenceKeys || []).join(' ')}`;
      return matchesAny(fullText, req.mustReferenceAny);
    });
    if (!found) {
      mismatches.push({
        failureClass: BenchmarkFailureClass.REPORT_OMITS_EVIDENCE,
        expected: req.concept,
        actual: 'Missing',
        details: `Report omitted required EVIDENCED concept: ${req.concept}`
      });
    }
  }

  // 4. Check Required Unknowns
  const unknownClaims = llmOutput.unknowns || [];
  for (const req of expectedMinimum.requiredUnknowns) {
    const found = unknownClaims.some((unknown: any) => {
      const fullText = `${unknown.insightKey || ''} ${unknown.description || ''} ${unknown.reasoning || ''}`;
      return matchesAny(fullText, req.mustReferenceAny);
    });
    if (!found) {
      mismatches.push({
        failureClass: BenchmarkFailureClass.AI_MISCLASSIFIED_UNKNOWN,
        expected: req.concept,
        actual: 'Missing or misclassified as fact',
        details: `Report failed to classify concept as UNKNOWN: ${req.concept}`
      });
    }
  }

  // 5. Check Required QA Scenarios
  const qaScenarios = llmOutput.qaScenarios || [];
  for (const req of expectedMinimum.requiredQaScenarios) {
    const found = qaScenarios.some((qa: any) => {
      const fullText = `${qa.scenarioKey || ''} ${qa.description || ''}`;
      return matchesAny(fullText, req.mustReferenceAny);
    });
    if (!found) {
      mismatches.push({
        // Soft report for QA missing
        failureClass: BenchmarkFailureClass.REPORT_OMITS_EVIDENCE, // Could add a specific QA failure class, but this fits
        expected: req.concept,
        actual: 'Missing',
        details: `Report omitted optional/required QA Scenario: ${req.concept}`
      });
    }
  }

  return {
    fixtureName,
    totalMismatches: mismatches.length,
    mismatches,
    // Add additional top level stats if needed
  } as BenchmarkReport;
};
