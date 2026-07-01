import { z } from 'zod';
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
});
