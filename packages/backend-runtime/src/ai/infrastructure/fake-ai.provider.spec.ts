import { z } from 'zod';
import { EvidencePackFormatter, renderPrompt } from '@ba-helper/application';
import { FakeLlmProvider } from './fake-ai.provider';

describe('FakeLlmProvider', () => {
  let provider: FakeLlmProvider;

  beforeEach(() => {
    provider = new FakeLlmProvider();
  });

  const schema = z.object({
    insights: z.array(z.any()),
    unknowns: z.array(z.any()),
    qaScenarios: z.array(z.any()),
  });

  it('returns generic unknowns for non-domain specific prompts (regression test)', async () => {
    const userPrompt = 'Enforce Author-Only Article Mutation ArticleController.update ArticleController.delete';
    const request = { userPrompt, systemPrompt: '' };

    const result = await provider.generateStructured(request, schema);
    const data = result.data as any;

    expect(data.insights).toHaveLength(0);
    expect(data.qaScenarios).toHaveLength(0);
    expect(data.unknowns).toHaveLength(1);
    expect(data.unknowns[0].insightKey).toBe('unknown:generic-behavior');
    
    const rawOutput = JSON.stringify(data).toLowerCase();
    expect(rawOutput).not.toContain('refund');
    expect(rawOutput).not.toContain('booking');
    expect(rawOutput).not.toContain('cancel');
    expect(rawOutput).not.toContain('slot');
    expect(rawOutput).not.toContain('payment');
  });

  it('returns booking insights for explicit booking prompts', async () => {
    const userPrompt = 'Please analyze api:booking.controller.cancel and service-method:payment.service.refund';
    const request = { userPrompt, systemPrompt: '' };

    const result = await provider.generateStructured(request, schema);
    const data = result.data as any;

    expect(data.insights.length).toBeGreaterThan(0);
    expect(data.unknowns.length).toBeGreaterThan(0);
    
    const rawOutput = JSON.stringify(data).toLowerCase();
    expect(rawOutput).toContain('refund');
    expect(rawOutput).toContain('cancel');
  });

  it('returns order insights for explicit order prompts', async () => {
    const userPrompt = 'Check api:order.controller.cancelOrder and service-method:order.service.cancelOrder logic. OrderService.cancelOrder';
    const request = { userPrompt, systemPrompt: '' };

    const result = await provider.generateStructured(request, schema);
    const data = result.data as any;

    expect(data.insights.length).toBeGreaterThan(0);
    expect(data.unknowns.length).toBeGreaterThan(0);
    expect(data.qaScenarios.length).toBeGreaterThan(0);
    
    const rawOutput = JSON.stringify(data).toLowerCase();
    expect(rawOutput).toContain('order');
    expect(rawOutput).toContain('cancel');
  });

  it('binds fake evidenced claims to canonical evidence keys from formatted records', async () => {
    const routeKey = 'api:src%2Forder%2Forder.controller.ts#OrderController.cancelOrder~ad0b8b37b55e51a2df881ec47da6a9555b3f444e34dd4d6a58e847d066454371';
    const serviceKey = 'service-method:src%2Forder%2Forder.service.ts#OrderService.cancelOrder~ad0b8b37b55e51a2df881ec47da6a9555b3f444e34dd4d6a58e847d066454371';
    const userPrompt = `## Change Request\nCancel order through OrderService.cancelOrder.\n\n## Domain Context\nOrder\n\n## Evidence Excerpts\n[EVIDENCE 1]\nartifactKey: ${routeKey}\nsymbol: OrderController.cancelOrder\nfile: src/order/order.controller.ts\ntype: API_ROUTE\nretrievalMethod: direct\nexcerpt:\n@Post('cancel')\n\n[EVIDENCE 2]\nartifactKey: ${serviceKey}\nsymbol: OrderService.cancelOrder\nfile: src/order/order.service.ts\ntype: SERVICE_METHOD\nretrievalMethod: direct\nexcerpt:\nasync cancelOrder() {}`;
    const result = await provider.generateStructured({ systemPrompt: '', userPrompt }, schema);
    const claims = result.data.insights.filter(item => item.certainty === 'EVIDENCED');
    expect(claims.flatMap(item => item.evidenceKeys).sort()).toEqual([routeKey, serviceKey].sort());
  });

  it.each([
    ['Release an occupied slot', ['service-method:slot.service.releaseSlot']],
    ['Prevent a duplicate payment refund', ['service-method:payment.service.refund']],
    ['Expose an API endpoint to cancel a booking', ['api:booking.controller.cancel']],
  ])('scopes fake claims to the change request: %s', async (change, expected) => {
    const evidenceKeys = ['api:booking.controller.cancel', 'service-method:payment.service.refund',
      'service-method:slot.service.releaseSlot', 'service-method:notification.service.notifyOwner'];
    const result = await provider.generateStructured({ systemPrompt: '',
      userPrompt: `## Change Request\n${change}\n\n## Domain Context\nBooking\n\n## Evidence Excerpts\n${evidenceKeys.join('\n')}` }, schema);
    const claims = result.data.insights.filter(item => item.certainty === 'EVIDENCED');
    expect(claims.flatMap(item => item.evidenceKeys).sort()).toEqual([...expected].sort());
  });

  it('does not confuse a compound method identifier with a shorter route method', async () => {
    const result = await provider.generateStructured({ systemPrompt: '', userPrompt:
      '## Change Request\nregisterUser must use findByEmail\n\n## Domain Context\nGeneral\n\n## Evidence Excerpts\n' +
      'api:user.controller.register service-method:user.service.registerUser service-method:user.repository.findByEmail' }, schema);
    expect(result.data.insights.filter(item => item.certainty === 'EVIDENCED').flatMap(item => item.evidenceKeys).sort())
      .toEqual(['service-method:user.repository.findByEmail', 'service-method:user.service.registerUser']);
  });

  it('binds claims to JSON-escaped evidence from the current impact prompt', async () => {
    const evidence = EvidencePackFormatter.format([
      {
        artifactKey: 'api:booking.controller.cancel',
        symbolName: 'BookingController.cancel',
        filePath: 'src/booking/booking.controller.ts',
        artifactType: 'API_ROUTE',
        excerpt: '@Post("cancel")',
        retrievalMethod: 'LEXICAL',
      },
      {
        artifactKey: 'service-method:payment.service.refund',
        symbolName: 'PaymentService.refund',
        filePath: 'src/payment/payment.service.ts',
        artifactType: 'SERVICE_METHOD',
        excerpt: 'return payment.refund();',
        retrievalMethod: 'LEXICAL',
      },
    ]);
    const { userPrompt } = renderPrompt('IMPACT_ANALYSIS', {
      changeRequest: 'Cancel a booking and issue a refund.',
      domainContext: 'BOOKING',
      snapshotId: 'snapshot-1',
      analyzerVersion: 'analyzer@1.0.0',
      evidenceExcerpts: evidence,
    });

    const result = await provider.generateStructured({ systemPrompt: '', userPrompt }, schema);
    const claim = result.data.insights.find(item => item.insightKey === 'claim:cancel-refund');

    expect(claim?.certainty).toBe('EVIDENCED');
    expect(claim?.evidenceKeys).toEqual(['service-method:payment.service.refund']);
  });

  it('does not emit a refund claim when escaped prompt evidence lacks a refund artifact', async () => {
    const evidence = EvidencePackFormatter.format([
      {
        artifactKey: 'api:booking.controller.cancel',
        symbolName: 'BookingController.cancel',
        filePath: 'src/booking/booking.controller.ts',
        artifactType: 'API_ROUTE',
        excerpt: '@Post("cancel")',
        retrievalMethod: 'LEXICAL',
      },
      {
        artifactKey: 'service-method:booking.service.cancelBooking',
        symbolName: 'BookingService.cancelBooking',
        filePath: 'src/booking/booking.service.ts',
        artifactType: 'SERVICE_METHOD',
        excerpt: 'cancelBooking(id: string) {}',
        retrievalMethod: 'LEXICAL',
      },
    ]);
    const { userPrompt } = renderPrompt('IMPACT_ANALYSIS', {
      changeRequest: 'Cancel a booking and issue a refund.',
      domainContext: 'BOOKING',
      snapshotId: 'snapshot-1',
      analyzerVersion: 'analyzer@1.0.0',
      evidenceExcerpts: evidence,
    });

    const result = await provider.generateStructured({ systemPrompt: '', userPrompt }, schema);

    expect(result.data.insights.some(item => item.insightKey === 'claim:cancel-refund')).toBe(false);
  });
});
