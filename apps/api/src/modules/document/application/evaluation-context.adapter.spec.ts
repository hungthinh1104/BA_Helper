import { EvaluationContextAdapter, RESEARCH_FINDINGS_PATH, SAME_SUBSET_COMPARISON_PATH } from './evaluation-context.adapter';
import * as fs from 'fs';
import * as path from 'path';

jest.mock('fs');

describe('EvaluationContextAdapter', () => {
  let adapter: EvaluationContextAdapter;

  beforeEach(() => {
    adapter = new EvaluationContextAdapter();
    jest.resetAllMocks();
  });

  it('returns mapped context when artifacts valid', () => {
    (fs.existsSync as jest.Mock).mockReturnValue(true);
    (fs.readFileSync as jest.Mock).mockImplementation((filePath: string) => {
      if (filePath.endsWith(RESEARCH_FINDINGS_PATH)) {
        return JSON.stringify({
          datasetVersion: 'v0',
          subsetId: 'clean-vector-ready-v0',
          knownLimits: ['No superiority claim'],
          evidenceQualityNotes: [],
          datasetExpansionRecommendation: ['Add more cases']
        });
      }
      if (filePath.endsWith(SAME_SUBSET_COMPARISON_PATH)) {
        return JSON.stringify({
          caseCount: 1,
          comparisonPolicy: {
            winnerAllowed: false,
            interpretation: 'ILLUSTRATIVE_ONLY'
          }
        });
      }
      return '{}';
    });

    const context = adapter.getEvaluationContext();
    expect(context).toBeDefined();
    expect(context?.datasetVersion).toBe('v0');
    expect(context?.subsetSize).toBe('1/6');
    expect(context?.interpretation).toBe('ILLUSTRATIVE_ONLY');
    expect(context?.datasetExpansionRecommendations).toContain('Add more cases');
  });

  it('returns null when research findings missing', () => {
    (fs.existsSync as jest.Mock).mockImplementation((filePath: string) => {
      return !filePath.endsWith(RESEARCH_FINDINGS_PATH);
    });

    const context = adapter.getEvaluationContext();
    expect(context).toBeNull();
  });

  it('returns null when comparison missing', () => {
    (fs.existsSync as jest.Mock).mockImplementation((filePath: string) => {
      return !filePath.endsWith(SAME_SUBSET_COMPARISON_PATH);
    });

    const context = adapter.getEvaluationContext();
    expect(context).toBeNull();
  });

  it('returns null when forbidden claim exists deeply', () => {
    (fs.existsSync as jest.Mock).mockReturnValue(true);
    (fs.readFileSync as jest.Mock).mockImplementation((filePath: string) => {
      if (filePath.endsWith(RESEARCH_FINDINGS_PATH)) {
        return JSON.stringify({
          datasetVersion: 'v0',
          deepNested: {
            deeper: {
              winner: 'VECTOR'
            }
          }
        });
      }
      return JSON.stringify({});
    });

    const context = adapter.getEvaluationContext();
    expect(context).toBeNull();
  });

  it('returns null when comparisonPolicy.winnerAllowed is true', () => {
    (fs.existsSync as jest.Mock).mockReturnValue(true);
    (fs.readFileSync as jest.Mock).mockImplementation((filePath: string) => {
      if (filePath.endsWith(RESEARCH_FINDINGS_PATH)) {
        return JSON.stringify({});
      }
      if (filePath.endsWith(SAME_SUBSET_COMPARISON_PATH)) {
        return JSON.stringify({
          comparisonPolicy: { winnerAllowed: true }
        });
      }
      return '{}';
    });

    const context = adapter.getEvaluationContext();
    expect(context).toBeNull();
  });

  it('preserves researchFindingsArtifact path', () => {
    (fs.existsSync as jest.Mock).mockReturnValue(true);
    (fs.readFileSync as jest.Mock).mockImplementation(() => JSON.stringify({}));

    const context = adapter.getEvaluationContext();
    expect(context?.researchFindingsArtifact).toBe(RESEARCH_FINDINGS_PATH);
    expect(context?.sameSubsetComparisonArtifact).toBe(SAME_SUBSET_COMPARISON_PATH);
  });
});
