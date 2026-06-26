import { DiagnosticRiskEvaluator } from '@ba-helper/application';

describe('DiagnosticRiskEvaluator', () => {
  it('matches plural requirement term to singular diagnostic candidate', () => {
    const isRelevant = DiagnosticRiskEvaluator.isRelevant(
      'Allow users to cancel paid bookings and receive refunds.',
      ['refund']
    );
    expect(isRelevant).toBe(true);
  });

  it('matches plural diagnostic candidate to singular requirement term', () => {
    const isRelevant = DiagnosticRiskEvaluator.isRelevant(
      'Allow users to cancel paid booking and receive refund.',
      ['refunds']
    );
    expect(isRelevant).toBe(true);
  });

  it('does not match unrelated terms like users against refund', () => {
    const isRelevant = DiagnosticRiskEvaluator.isRelevant(
      'Allow users to cancel paid booking and receive refund.',
      ['invoices']
    );
    expect(isRelevant).toBe(false);
  });

  it('matches suffix-stripped terms like RefundController', () => {
    const isRelevant = DiagnosticRiskEvaluator.isRelevant(
      'We need to process the refund immediately.',
      ['RefundController']
    );
    expect(isRelevant).toBe(true);
  });

  it('matches suffix-stripped terms like booking_id', () => {
    const isRelevant = DiagnosticRiskEvaluator.isRelevant(
      'Update the booking status.',
      ['booking_id']
    );
    expect(isRelevant).toBe(true);
  });

  it('matches suffix-stripped terms like PaymentService', () => {
    const isRelevant = DiagnosticRiskEvaluator.isRelevant(
      'Verify the payment amounts.',
      ['PaymentService']
    );
    expect(isRelevant).toBe(true);
  });

  it('ignores irrelevant terms like api or admin', () => {
    const isRelevant = DiagnosticRiskEvaluator.isRelevant(
      'Update the booking status.',
      ['api', 'admin']
    );
    expect(isRelevant).toBe(false);
  });

  it('ensures api prefix does not match generic API requirement', () => {
    // Even if the requirement contains "API", a generic route prefix like "api" should not trigger a risk
    const isRelevant = DiagnosticRiskEvaluator.isRelevant(
      'Create a new external API for processing refunds.',
      ['api', 'v1']
    );
    expect(isRelevant).toBe(false);
  });

  it('preserves words ending in s that are not plurals (status, class, business)', () => {
    // Should NOT match because 'status' is not stripped to 'statu' which would wrongly match 'statue'
    const isRelevant1 = DiagnosticRiskEvaluator.isRelevant('A statue was built', ['status']);
    expect(isRelevant1).toBe(false);

    // Should NOT match because 'class' is not stripped to 'clas'
    const isRelevant2 = DiagnosticRiskEvaluator.isRelevant('A clash of clans', ['class']);
    expect(isRelevant2).toBe(false);

    // Should NOT match because 'business' is not stripped to 'busines'
    const isRelevant3 = DiagnosticRiskEvaluator.isRelevant('A busy nest', ['business']);
    expect(isRelevant3).toBe(false);

    // SHOULD match exact non-plural words correctly
    const isRelevant4 = DiagnosticRiskEvaluator.isRelevant('Update the booking status.', ['status']);
    expect(isRelevant4).toBe(true);
    
    const isRelevant5 = DiagnosticRiskEvaluator.isRelevant('A new business class.', ['class', 'business']);
    expect(isRelevant5).toBe(true);
  });

  it('handles empty terms gracefully', () => {
    const isRelevant = DiagnosticRiskEvaluator.isRelevant('Update booking', []);
    expect(isRelevant).toBe(false);
  });

  it('never propagates scanner capability context diagnostics', () => {
    expect(DiagnosticRiskEvaluator.getPropagationMode({
      code: 'SCANNER_CAPABILITY_SUMMARY',
      severity: 'INFO',
      payload: { candidateTerms: ['refunds'] },
    })).toBe('NONE');
  });

  it('routes boundary and not-extracted diagnostics through artifact context only', () => {
    expect(DiagnosticRiskEvaluator.getPropagationMode({
      code: 'GO_ROUTE_GROUP_BOUNDARY',
      severity: 'WARN',
      payload: { candidateTerms: ['refunds'] },
    })).toBe('CONTEXT');

    expect(DiagnosticRiskEvaluator.getPropagationMode({
      code: 'METHOD_NOT_EXTRACTED',
      severity: 'WARN',
      payload: { candidateTerms: ['refunds'] },
    })).toBe('CONTEXT');
  });

  it('uses lexical propagation only for unsupported route diagnostics with candidate terms', () => {
    expect(DiagnosticRiskEvaluator.getPropagationMode({
      code: 'RB_RESOURCE_ROUTE_UNSUPPORTED',
      severity: 'WARN',
      payload: { candidateTerms: ['refunds'] },
    })).toBe('LEXICAL');

    expect(DiagnosticRiskEvaluator.getPropagationMode({
      code: 'RB_RESOURCE_ROUTE_UNSUPPORTED',
      severity: 'WARN',
      payload: {},
    })).toBe('NONE');
  });

  it('builds deterministic structured keys from code, file, pattern, and candidate terms', () => {
    const base = {
      code: 'RB_RESOURCE_ROUTE_UNSUPPORTED',
      payload: {
        relativePath: 'config/routes.rb',
        unsupportedPattern: 'resources',
      },
    };

    expect(DiagnosticRiskEvaluator.buildStructuredInsightKey({
      ...base,
      payload: { ...base.payload, candidateTerms: ['refunds'] },
    })).not.toBe(DiagnosticRiskEvaluator.buildStructuredInsightKey({
      ...base,
      payload: { ...base.payload, candidateTerms: ['users'] },
    }));
  });
});
