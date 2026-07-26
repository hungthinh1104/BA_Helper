import { ANALYZER_VERSION } from '@ba-helper/analyzer';
import {
  getCurrentAnalyzerVersion,
  isAnalyzerVersionOutdated,
} from './analyzer-version';

describe('analyzer-version helper', () => {
  it('returns the current analyzer version constant', () => {
    expect(getCurrentAnalyzerVersion()).toBe(ANALYZER_VERSION);
  });

  it('marks different analyzer versions as outdated', () => {
    expect(isAnalyzerVersionOutdated('analyzer@0.1.0')).toBe(true);
  });

  it('does not mark the current analyzer version as outdated', () => {
    expect(isAnalyzerVersionOutdated(ANALYZER_VERSION)).toBe(false);
  });
});
