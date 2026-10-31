import { parseStudyValidationArguments } from '../../scripts/lib/study-validation-arguments';

describe('parseStudyValidationArguments', () => {
  it('preserves the default output when no destination is provided', () => {
    expect(parseStudyValidationArguments(['--', 'dataset.json'])).toEqual({ inputPath: 'dataset.json' });
  });

  it('accepts an explicit output destination in either supported form', () => {
    expect(parseStudyValidationArguments(['dataset.json', '--output', 'pilot/scorecard.json']))
      .toEqual({ inputPath: 'dataset.json', outputPath: 'pilot/scorecard.json' });
    expect(parseStudyValidationArguments(['--output=pilot/scorecard.json', 'dataset.json']))
      .toEqual({ inputPath: 'dataset.json', outputPath: 'pilot/scorecard.json' });
  });

  it('rejects missing inputs, destinations, and unknown options', () => {
    expect(() => parseStudyValidationArguments([])).toThrow('Usage:');
    expect(() => parseStudyValidationArguments(['dataset.json', '--output'])).toThrow('requires a destination');
    expect(() => parseStudyValidationArguments(['dataset.json', '--unexpected'])).toThrow('Unknown option');
  });
});
