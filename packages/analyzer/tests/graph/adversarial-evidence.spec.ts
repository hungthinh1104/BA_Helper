import { adversarialCases } from '../../../../tests/evaluation/adversarial-evidence/cases';
import { compareRelationshipSets, runAdversarialEvidenceVerification } from '../../../../tests/evaluation/adversarial-evidence/runner';

describe('G2B adversarial evidence verification', () => {
  const report = runAdversarialEvidenceVerification();

  it.each(adversarialCases.map(testCase => [testCase.id]))('%s satisfies its declared property', caseId => {
    const result = report.cases.find(item => item.id === caseId);
    expect(result).toBeDefined();
    expect({
      passed: result?.passed,
      missingExpectedEdges: result?.missingExpectedEdges,
      invalidSupportedEdges: result?.invalidSupportedEdges,
      provenanceViolations: result?.provenanceViolations,
      unexpectedDiagnostics: result?.unexpectedDiagnostics,
      expectedDiagnosticsMissing: result?.expectedDiagnosticsMissing,
    }).toEqual({ passed: true, missingExpectedEdges: [], invalidSupportedEdges: [],
      provenanceViolations: [], unexpectedDiagnostics: [], expectedDiagnosticsMissing: [] });
  });

  it('detects a deliberately injected wrong target as an invalid supported relationship', () => {
    const expected = report.cases[0].expected.transformed;
    const invalid = { ...expected[0], to: { filePath: 'src/other.service.ts', symbolName: 'OtherService.refund' } };
    expect(compareRelationshipSets(expected, [...expected, invalid])).toMatchObject({
      unexpected: [JSON.stringify(['TESTS', invalid.from, invalid.to])],
    });
  });

  it('rejects a deliberately injected source location that does not contain the target call', () => {
    expect(report.metrics.provenanceTamperRejection).toMatchObject({
      status: 'PASS', expectedReason: 'TARGET_CALL_NOT_AT_REPORTED_LOCATION',
      detectedReasons: ['TARGET_CALL_NOT_AT_REPORTED_LOCATION'], passed: true,
    });
  });

  it('reports bounded static properties without implying runtime or human validation', () => {
    expect(report.status).toBe('PASS');
    expect(report.metrics.propertySatisfaction).toEqual({ passed: adversarialCases.length,
      evaluated: adversarialCases.length, rate: 1 });
    expect(report.metrics.provenanceIntegrity.rate).toBe(1);
    expect(report.metrics.provenanceTamperRejection.status).toBe('PASS');
    expect(report.metrics.unresolvedCorrectness.status).toBe('PASS');
    expect(report.limitations).toEqual(expect.arrayContaining([
      expect.stringContaining('No repository code is executed'),
      expect.stringContaining('not independently adjudicated'),
    ]));
  });
});
