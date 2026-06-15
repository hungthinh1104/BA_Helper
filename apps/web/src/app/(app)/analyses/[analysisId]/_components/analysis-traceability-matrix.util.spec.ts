import { classifyInsight } from './analysis-traceability-matrix.util';
import type { InsightListResponse } from '@ba-helper/contracts';

type Insight = InsightListResponse['items'][number];

describe('AnalysisTraceabilityMatrixUtil', () => {
  describe('classifyInsight', () => {
    it('should classify QA_SCENARIO as QA_COVERAGE', () => {
      const insight = { category: 'QA_SCENARIO', certainty: 'EVIDENCED' } as Insight;
      expect(classifyInsight(insight)).toEqual({
        traceType: 'QA_COVERAGE',
        sourceKind: 'qa_scenario',
      });
    });

    it('should classify QUESTION as OPEN_QUESTION', () => {
      const insight = { category: 'QUESTION', certainty: 'UNKNOWN' } as Insight;
      expect(classifyInsight(insight)).toEqual({
        traceType: 'OPEN_QUESTION',
        sourceKind: 'open_question',
      });
    });

    it('should classify UNKNOWN as DIAGNOSTIC_DERIVED_RISK', () => {
      const insight = { category: 'UNKNOWN', certainty: 'UNKNOWN' } as Insight;
      expect(classifyInsight(insight)).toEqual({
        traceType: 'DIAGNOSTIC_DERIVED_RISK',
        sourceKind: 'diagnostic_risk',
      });
    });

    it('should classify CLAIM with EVIDENCED certainty as EVIDENCE_BACKED_IMPACT', () => {
      const insight = { category: 'CLAIM', certainty: 'EVIDENCED' } as Insight;
      expect(classifyInsight(insight)).toEqual({
        traceType: 'EVIDENCE_BACKED_IMPACT',
        sourceKind: 'insight',
      });
    });

    it('should classify CLAIM with INFERRED certainty as INFERRED_IMPACT', () => {
      const insight = { category: 'CLAIM', certainty: 'INFERRED' } as Insight;
      expect(classifyInsight(insight)).toEqual({
        traceType: 'INFERRED_IMPACT',
        sourceKind: 'insight',
      });
    });

    it('should classify CLAIM with diagnostic metadata as DIAGNOSTIC_DERIVED_RISK', () => {
      const insight = { 
        category: 'CLAIM', 
        certainty: 'INFERRED',
        metadata: { diagnosticCode: 'SOME_CODE' }
      } as unknown as Insight;
      expect(classifyInsight(insight)).toEqual({
        traceType: 'DIAGNOSTIC_DERIVED_RISK',
        sourceKind: 'diagnostic_risk',
      });
    });

    it('should return null for ACCEPTANCE_CRITERIA', () => {
      const insight = { category: 'ACCEPTANCE_CRITERIA', certainty: 'EVIDENCED' } as Insight;
      expect(classifyInsight(insight)).toBeNull();
    });
  });
});
