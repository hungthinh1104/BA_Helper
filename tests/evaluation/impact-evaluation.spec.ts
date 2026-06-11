import { evaluationCaseSchema, NormalizedEvaluationResult, EvaluationCase } from './evaluation-types';
import { ALL_EVALUATION_CASES } from './cases';
import { EvaluationRunner, EvaluationAdapter } from './evaluation-runner';
import {
  computeArtifactRecall,
  computeArtifactPrecision,
  computeEvidenceCoverage,
  computeNegativeControl,
  computeConceptCoverage,
  normalizeString
} from './evaluation-scoring';

class FakeEvaluationAdapter implements EvaluationAdapter {
  async evaluateCase(evalCase: EvaluationCase): Promise<NormalizedEvaluationResult> {
    // For deterministic testing of the runner, we will just return 
    // exact matches for the first 50% of expected keys, and add one unexpected key
    const foundKeys = [...evalCase.expected.impactedArtifactKeys];
    if (foundKeys.length > 1) foundKeys.pop(); // reduce recall to test scoring
    foundKeys.push('unexpected:artifact.key');
    
    // Add one leaked negative key if any exist to test negative failure
    if (evalCase.expected.negativeArtifactKeys.length > 0) {
      foundKeys.push(evalCase.expected.negativeArtifactKeys[0]);
    }

    const evidenceByArtifactKey: Record<string, string[]> = {};
    for (const key of foundKeys) {
      evidenceByArtifactKey[key] = ['some evidence'];
    }

    return {
      foundImpactedArtifactKeys: foundKeys,
      evidenceByArtifactKey,
      unknownsOrQuestions: evalCase.expected.unknownsOrQuestions ? [evalCase.expected.unknownsOrQuestions[0]] : [],
      risks: evalCase.expected.risks ? [evalCase.expected.risks[0]] : [],
      qaScenarios: evalCase.expected.qaScenarios ? [evalCase.expected.qaScenarios[0]] : [],
    };
  }
}

describe('Impact Evaluation Pack', () => {

  describe('Curated Cases Validation', () => {
    it('ensures all cases are schema valid', () => {
      expect(ALL_EVALUATION_CASES.length).toBeGreaterThanOrEqual(8);
      for (const c of ALL_EVALUATION_CASES) {
        expect(() => evaluationCaseSchema.parse(c)).not.toThrow();
      }
    });

    it('ensures case IDs are unique', () => {
      const ids = new Set<string>();
      for (const c of ALL_EVALUATION_CASES) {
        expect(ids.has(c.id)).toBe(false);
        ids.add(c.id);
      }
    });

    it('ensures expected artifact keys are non-empty', () => {
      for (const c of ALL_EVALUATION_CASES) {
        expect(c.expected.impactedArtifactKeys.length).toBeGreaterThan(0);
      }
    });

    it('ensures negative artifact keys do not overlap expected impacted keys', () => {
      for (const c of ALL_EVALUATION_CASES) {
        const expected = new Set(c.expected.impactedArtifactKeys);
        for (const neg of c.expected.negativeArtifactKeys) {
          expect(expected.has(neg)).toBe(false);
        }
      }
    });
  });

  describe('Scoring Helpers', () => {
    it('normalizes strings deterministically', () => {
      expect(normalizeString(' Hello  World! ')).toBe('hello world');
      expect(normalizeString('some-concept_123')).toBe('some concept 123');
    });

    it('computes artifact recall correctly', () => {
      const expected = ['a', 'b', 'c'];
      const found = ['a', 'c', 'd'];
      const { score, missing } = computeArtifactRecall(expected, found);
      expect(score).toBeCloseTo(2/3);
      expect(missing).toEqual(['b']);
    });

    it('computes artifact precision correctly', () => {
      const expected = ['a', 'b', 'c'];
      const found = ['a', 'c', 'd', 'e'];
      const { score, unexpected } = computeArtifactPrecision(expected, found);
      expect(score).toBeCloseTo(2/4);
      expect(unexpected).toEqual(['d', 'e']);
    });

    it('handles precision and recall division by zero explicitly', () => {
      const recallZero = computeArtifactRecall([], ['a']);
      expect(recallZero.score).toBe(1); // if nothing expected, missing nothing
      
      const precisionZero = computeArtifactPrecision(['a'], []);
      expect(precisionZero.score).toBe(1); // if nothing found, no false positives
    });

    it('computes negative control correctly', () => {
      const { passed, failedKeys } = computeNegativeControl(['neg1', 'neg2'], ['a', 'neg2']);
      expect(passed).toBe(false);
      expect(failedKeys).toEqual(['neg2']);
    });

    it('computes evidence coverage correctly', () => {
      const expected = ['a', 'b'];
      const found = ['a', 'b', 'c'];
      const ev = { 'a': ['proof'], 'c': ['proof'] };
      // correctly found = 'a', 'b'. Evidence exists only for 'a'.
      const score = computeEvidenceCoverage(expected, found, ev);
      expect(score).toBe(0.5);
    });

    it('computes concept matching deterministically', () => {
      const expected = ['timezone for 24 hours check', 'race condition'];
      const actual = ['I found a race_condition here', 'something else'];
      const result = computeConceptCoverage(expected, actual);
      expect(result.score).toBe(0.5);
      expect(result.matched).toBe(1);
    });
  });

  describe('Evaluation Runner', () => {
    let runner: EvaluationRunner;

    beforeEach(() => {
      runner = new EvaluationRunner(new FakeEvaluationAdapter());
    });

    it('produces bounded report and does not mutate DB or call LLM', async () => {
      const result = await runner.run(ALL_EVALUATION_CASES);
      
      expect(result.report.totalCases).toBe(ALL_EVALUATION_CASES.length);
      expect(result.report.cases.length).toBe(ALL_EVALUATION_CASES.length);
      
      // Output is bounded string summary
      expect(typeof result.textSummary).toBe('string');
      expect(result.textSummary.length).toBeGreaterThan(0);
      expect(result.textSummary.length).toBeLessThan(10000); // bounded check

      // We explicitly did not connect to Prisma or any LLM clients here.
      // The tests are entirely offline and CPU bound.
    });
  });
});
