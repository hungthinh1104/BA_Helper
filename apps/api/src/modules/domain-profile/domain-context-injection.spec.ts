/**
 * Domain-aware Risk/QA Template Injection — Unit Tests (Phase 26B)
 *
 * Covers:
 * 1. buildCompactDomainContext output is bounded and deterministic.
 * 2. PAYMENT profile produces payment-specific risk/QA framing.
 * 3. REFUND profile produces refund-specific risk/QA framing.
 * 4. NOTIFICATION profile produces notification-specific framing.
 * 5. UNKNOWN domain produces safe generic framing — no domain-specific claims.
 * 6. renderPrompt includes domainContext in user prompt.
 * 7. Domain context does not invent evidence — only framing.
 */
import { buildCompactDomainContext, getDomainProfile } from './index';
import { renderPrompt } from '../../modules/ai/domain/prompt-registry';

describe('buildCompactDomainContext', () => {
  it('produces PAYMENT-specific risk and QA framing', () => {
    const ctx = buildCompactDomainContext('PAYMENT');
    expect(ctx).toContain('Domain: PAYMENT');
    expect(ctx).toContain('payment');
    // Risk focus contains payment-specific concerns
    expect(ctx.toLowerCase()).toMatch(/duplicate|double charge|idempotency/i);
    // QA focus contains payment-specific scenarios
    expect(ctx.toLowerCase()).toMatch(/payment|charge|idempotency/i);
  });

  it('produces REFUND-specific risk and QA framing', () => {
    const ctx = buildCompactDomainContext('REFUND');
    expect(ctx).toContain('Domain: REFUND');
    expect(ctx).toContain('refund');
    expect(ctx.toLowerCase()).toMatch(/double refund|ledger|reversal/i);
    expect(ctx.toLowerCase()).toMatch(/idempotency|partial refund/i);
  });

  it('produces NOTIFICATION-specific risk and QA framing', () => {
    const ctx = buildCompactDomainContext('NOTIFICATION');
    expect(ctx).toContain('Domain: NOTIFICATION');
    expect(ctx).toContain('notification');
    expect(ctx.toLowerCase()).toMatch(/duplicate notification|delivery/i);
    expect(ctx.toLowerCase()).toMatch(/idempotency|notification/i);
  });

  it('produces BOOKING-specific framing for BOOKING domain', () => {
    const ctx = buildCompactDomainContext('BOOKING');
    expect(ctx).toContain('Domain: BOOKING');
    expect(ctx).toContain('booking');
  });

  it('produces UNKNOWN safe generic framing for unrecognized domain — no domain-specific claims', () => {
    const ctx = buildCompactDomainContext('LEDGER');
    expect(ctx).toContain('Domain: UNKNOWN');
    // Must NOT contain highly specific domain terms
    expect(ctx.toLowerCase()).not.toContain('duplicate payment');
    expect(ctx.toLowerCase()).not.toContain('double refund');
    expect(ctx.toLowerCase()).not.toContain('duplicate notification');
  });

  it('produces UNKNOWN safe generic framing for undefined domain', () => {
    // undefined → BOOKING default (MVP)
    const ctx = buildCompactDomainContext(undefined);
    expect(ctx).toContain('Domain: BOOKING');
  });

  it('is bounded — at most 5 glossary terms in output', () => {
    const ctx = buildCompactDomainContext('PAYMENT');
    const keyTermsLine = ctx.split('\n').find((l) => l.startsWith('Key terms:')) ?? '';
    const terms = keyTermsLine.replace('Key terms:', '').split(',').map((t) => t.trim()).filter(Boolean);
    expect(terms.length).toBeLessThanOrEqual(5);
  });

  it('is bounded — at most 4 risk categories in output', () => {
    const ctx = buildCompactDomainContext('PAYMENT');
    // Count bullet-pointed lines in the Risk focus section
    const riskLines = ctx.split('\n').filter((l) => l.startsWith('- ') && !l.toLowerCase().includes('verify'));
    expect(riskLines.length).toBeLessThanOrEqual(4);
  });

  it('is bounded — at most 3 QA focus areas in output', () => {
    const ctx = buildCompactDomainContext('PAYMENT');
    // QA hints are the last bullet-point lines
    const qaProfile = getDomainProfile('PAYMENT').qaScenarioTemplates.slice(0, 3);
    for (const qa of qaProfile) {
      expect(ctx).toContain(qa);
    }
    // And at most 3 QA items
    const qaSection = ctx.split('QA focus:')[1] ?? '';
    const qaLines = qaSection.split('\n').filter((l) => l.startsWith('- ')).length;
    expect(qaLines).toBeLessThanOrEqual(3);
  });

  it('is deterministic — same input always returns same output', () => {
    const first = buildCompactDomainContext('REFUND');
    const second = buildCompactDomainContext('REFUND');
    expect(first).toBe(second);
  });

  it('does not dump the full profile — glossary is truncated to 5', () => {
    const profile = getDomainProfile('BOOKING');
    const ctx = buildCompactDomainContext('BOOKING');
    // Full glossary has more than 5 terms
    expect(profile.glossary.length).toBeGreaterThan(5);
    // But prompt only has ≤5 terms
    const keyTermsLine = ctx.split('\n').find((l) => l.startsWith('Key terms:')) ?? '';
    const terms = keyTermsLine.replace('Key terms:', '').split(',').map((t) => t.trim()).filter(Boolean);
    expect(terms.length).toBeLessThanOrEqual(5);
  });
});

describe('renderPrompt with domainContext', () => {
  it('includes PAYMENT domain context in user prompt', () => {
    const ctx = buildCompactDomainContext('PAYMENT');
    const { userPrompt } = renderPrompt('IMPACT_ANALYSIS', {
      changeRequest: 'Allow users to retry a failed payment.',
      snapshotId: 'snap-1',
      analyzerVersion: 'v1',
      evidenceExcerpts: 'payment.service.ts:10-30 (PaymentService.charge)',
      domainContext: ctx,
    });
    expect(userPrompt).toContain('## Domain Context');
    expect(userPrompt).toContain('Domain: PAYMENT');
    expect(userPrompt).toContain('payment');
  });

  it('includes REFUND domain context in user prompt', () => {
    const ctx = buildCompactDomainContext('REFUND');
    const { userPrompt } = renderPrompt('IMPACT_ANALYSIS', {
      changeRequest: 'Issue a refund after cancellation.',
      snapshotId: 'snap-2',
      analyzerVersion: 'v1',
      evidenceExcerpts: 'refund.service.ts:10-30 (RefundService.process)',
      domainContext: ctx,
    });
    expect(userPrompt).toContain('Domain: REFUND');
    expect(userPrompt).toContain('refund');
  });

  it('includes UNKNOWN domain context for unrecognized domain — no domain-specific claims injected', () => {
    const ctx = buildCompactDomainContext('LEDGER');
    const { userPrompt } = renderPrompt('IMPACT_ANALYSIS', {
      changeRequest: 'Update ledger reconciliation logic.',
      snapshotId: 'snap-3',
      analyzerVersion: 'v1',
      evidenceExcerpts: 'ledger.service.ts:10-30',
      domainContext: ctx,
    });
    expect(userPrompt).toContain('Domain: UNKNOWN');
    expect(userPrompt).not.toContain('Duplicate payment');
    expect(userPrompt).not.toContain('double refund');
  });

  it('domain context section appears before evidence excerpts section', () => {
    const ctx = buildCompactDomainContext('BOOKING');
    const { userPrompt } = renderPrompt('IMPACT_ANALYSIS', {
      changeRequest: 'Cancel a booking and trigger refund.',
      snapshotId: 'snap-4',
      analyzerVersion: 'v1',
      evidenceExcerpts: 'booking.service.ts:10-30',
      domainContext: ctx,
    });
    const domainIdx = userPrompt.indexOf('## Domain Context');
    const evidenceIdx = userPrompt.indexOf('## Evidence Excerpts');
    expect(domainIdx).toBeGreaterThan(-1);
    expect(evidenceIdx).toBeGreaterThan(-1);
    expect(domainIdx).toBeLessThan(evidenceIdx);
  });

  it('domain context does not alter evidence-bound rules in systemPrompt', () => {
    const ctx = buildCompactDomainContext('PAYMENT');
    const { systemPrompt } = renderPrompt('IMPACT_ANALYSIS', {
      changeRequest: 'Allow payment retry.',
      snapshotId: 'snap-5',
      analyzerVersion: 'v1',
      evidenceExcerpts: 'payment.service.ts:10-30',
      domainContext: ctx,
    });
    // Evidence contract remains intact
    expect(systemPrompt).toContain('EVIDENCE CONTRACT');
    expect(systemPrompt).toContain('UNKNOWN CONTRACT');
    expect(systemPrompt).toContain('If no evidence supports a claim, output UNKNOWN');
  });
});
