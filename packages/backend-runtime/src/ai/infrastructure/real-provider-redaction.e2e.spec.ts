import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { z } from 'zod';
import type { AiConfig } from '../domain/ai-config';
import { AnthropicLlmProvider } from './anthropic.provider';
import { DeepseekLlmProvider } from './deepseek.provider';
import { GoogleLlmProvider } from './google.provider';
import { OpenAiLlmProvider } from './openai.provider';

describe('real-provider prompt redaction at the HTTP boundary', () => {
  let server: Server;
  let baseUrl: string;
  const capturedBodies: unknown[] = [];

  beforeAll(async () => {
    server = createServer((request, response) => {
      const chunks: Buffer[] = [];
      request.on('data', (chunk: Buffer | string) => chunks.push(Buffer.from(chunk)));
      request.on('end', () => {
        capturedBodies.push(JSON.parse(Buffer.concat(chunks).toString('utf8')));
        response.writeHead(200, { 'content-type': 'application/json' });
        const body = request.url?.includes(':generateContent')
          ? {
              candidates: [{ content: { parts: [{ text: '{"ok":true}' }], role: 'model' }, finishReason: 'STOP', index: 0 }],
              usageMetadata: { promptTokenCount: 1, candidatesTokenCount: 1, totalTokenCount: 2 },
            }
          : request.url?.endsWith('/messages')
            ? {
                id: 'local-test-response',
                type: 'message',
                role: 'assistant',
                model: 'local-test-model',
                content: [{ type: 'text', text: '{"ok":true}' }],
                stop_reason: 'end_turn',
                stop_sequence: null,
                usage: { input_tokens: 1, output_tokens: 1 },
              }
            : {
                id: 'local-test-response',
                object: 'chat.completion',
                created: 1,
                model: 'local-test-model',
                choices: [{ index: 0, message: { role: 'assistant', content: '{"ok":true}' }, finish_reason: 'stop' }],
                usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
              };
        response.end(JSON.stringify(body));
      });
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    });
  });

  beforeEach(() => {
    capturedBodies.length = 0;
  });

  it.each([
    ['DeepSeek', 'deepseek', (config: AiConfig) => new DeepseekLlmProvider(config)],
    ['OpenAI', 'openai', (config: AiConfig) => new OpenAiLlmProvider(config)],
    ['Anthropic', 'anthropic', (config: AiConfig) => new AnthropicLlmProvider(config)],
    ['Google', 'google', (config: AiConfig) => new GoogleLlmProvider(config)],
  ])('%s receives redacted system and user prompts despite a legacy opt-out', async (_name, providerName, createProvider) => {
    const systemPrompt = [
      'SYSTEM_CONTEXT_MARKER',
      'apiKey="sk-proj-system-demo-key-0123456789abcdefghijklmnop"',
      'GOOGLE_API_KEY=AIzaSystemDemoKey0123456789abcdefgh',
    ].join('\n');
    const userPrompt = [
      'USER_CONTEXT_MARKER',
      'Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJsb2NhbC1kZW1vIn0.local-signature',
      'DATABASE_URL=postgresql://analyst:local-db-password@db.test:5432/app',
      '-----BEGIN PRIVATE KEY-----\nTUFSS0VEX1RFU1RfS0VZ\n-----END PRIVATE KEY-----',
    ].join('\n');
    const secrets = [
      'sk-proj-system-demo-key-0123456789abcdefghijklmnop',
      'AIzaSystemDemoKey0123456789abcdefgh',
      'eyJhbGciOiJIUzI1NiJ9',
      'local-db-password',
      'TUFSS0VEX1RFU1RfS0VZ',
    ];

    for (const redactSecrets of [false, true]) {
      const provider = createProvider({
        provider: providerName,
        defaultModel: 'local-test-model',
        temperature: 0,
        maxTokens: 100,
        redactSecrets,
        apiKey: 'local-provider-key',
        baseUrl,
      } as unknown as AiConfig);

      await provider.generateStructured(
        { userPrompt, systemPrompt },
        z.object({ ok: z.boolean() }),
      );
    }

    expect(capturedBodies).toHaveLength(2);
    for (const body of capturedBodies) {
      const serializedRequest = JSON.stringify(body);
      expect(serializedRequest).toContain('SYSTEM_CONTEXT_MARKER');
      expect(serializedRequest).toContain('USER_CONTEXT_MARKER');
      for (const secret of secrets) expect(serializedRequest).not.toContain(secret);
      expect(serializedRequest.match(/\[REDACTED\]/g)?.length ?? 0).toBeGreaterThan(1);
    }
  });
});
