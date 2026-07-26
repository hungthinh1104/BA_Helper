import { resolve } from 'node:path';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { scanFixture, buildGraph, selectEvidenceCandidates } from '../../packages/analyzer/src';
import { evaluateLlmImpact } from './llm-impact-evaluator';
import { z } from 'zod';
import { FakeLlmProvider, DeepseekLlmProvider, OpenAiLlmProvider, AnthropicLlmProvider, GoogleLlmProvider, AiConfig, LlmProvider, renderPrompt, EvidencePackFormatter } from "@ba-helper/backend-runtime";

const ImpactAnalysisSchema = z.object({
  insights: z.array(z.any()).optional(),
  unknowns: z.array(z.any()).optional(),
  qaScenarios: z.array(z.any()).optional(),
});

describe('Order/Inventory LLM Output Benchmark', () => {
  const fixturePath = resolve(__dirname, '../fixtures/nestjs-order-inventory');
  const expectedDir = resolve(fixturePath, 'expected');
  
  it('evaluates fake or real LLM against minimum semantic requirements', async () => {
    // 1. Run deterministic pipeline
    const scanResult = scanFixture({
      fixturePath,
      analyzerVersion: 'ts-nestjs-analyzer@0.1.0',
    });
    const graphResult = buildGraph(scanResult);

    const changeRequest = 'Allow users to cancel an order before shipment and automatically release reserved inventory.';

    const retrievalResult = selectEvidenceCandidates({
      changeRequest,
      scan: scanResult,
      graph: graphResult,
      expandGraph: true
    });

    // 2. Prepare Context Prompt
    const evidenceCandidates = retrievalResult.artifacts.map(a => ({
      artifactKey: a.stableId,
      symbolName: a.symbolName,
      filePath: a.filePath,
      artifactType: a.type,
      excerpt: a.excerpt || '',
      retrievalMethod: 'LEXICAL_GRAPH',
      retrievalReason: a.retrievalReason || 'unknown',
    }));

    const { systemPrompt, userPrompt, version } = renderPrompt('IMPACT_ANALYSIS', {
      changeRequest,
      snapshotId: 'benchmark-snapshot',
      analyzerVersion: 'benchmark',
      evidenceExcerpts: EvidencePackFormatter.format(evidenceCandidates),
    });

    // 3. Choose Provider
    const runRealLlm = process.env.RUN_REAL_LLM_BENCHMARK === 'true';
    let provider: LlmProvider;
    
    if (runRealLlm) {
      const providerName = process.env.AI_PROVIDER || 'deepseek';
      console.log(`Running Real LLM Benchmark using provider: ${providerName}`);
      
      let defaultModel = 'deepseek-chat';
      if (providerName === 'openai') defaultModel = process.env.OPENAI_MODEL || 'gpt-4o';
      if (providerName === 'anthropic') defaultModel = process.env.ANTHROPIC_MODEL || 'claude-3-5-sonnet-20241022';
      if (providerName === 'google') defaultModel = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

      const config: AiConfig = {
        provider: providerName as any,
        defaultModel,
        temperature: 0,
        maxTokens: 4096,
        redactSecrets: false,
      };

      if (providerName === 'deepseek') {
        if (!process.env.DEEPSEEK_API_KEY) {
          console.warn('Skipping Real LLM Benchmark: DEEPSEEK_API_KEY not found');
          return;
        }
        provider = new DeepseekLlmProvider(config);
      } else if (providerName === 'openai') {
        if (!process.env.OPENAI_API_KEY) {
          console.warn('Skipping Real LLM Benchmark: OPENAI_API_KEY not found');
          return;
        }
        provider = new OpenAiLlmProvider(config);
      } else if (providerName === 'anthropic') {
        if (!process.env.ANTHROPIC_API_KEY) {
          console.warn('Skipping Real LLM Benchmark: ANTHROPIC_API_KEY not found');
          return;
        }
        provider = new AnthropicLlmProvider(config);
      } else if (providerName === 'google') {
        if (!process.env.GEMINI_API_KEY && !process.env.GOOGLE_AI_API_KEY) {
          console.warn('Skipping Real LLM Benchmark: GEMINI_API_KEY not found');
          return;
        }
        provider = new GoogleLlmProvider(config);
      } else {
        throw new Error(`Unsupported AI_PROVIDER for real benchmark: ${providerName}`);
      }
    } else {
      provider = new FakeLlmProvider();
    }

    let result;
    try {
      result = await provider.generateStructured({
        userPrompt,
        systemPrompt,
      }, ImpactAnalysisSchema);
    } catch (e: any) {
      console.log('AI PARSE ERROR rawText:', e.details?.rawText);
      console.log('AI PARSE ERROR extractedText:', e.details?.extractedText);
      throw e;
    }

    // 4. Load Minimum Expectations
    const minimumImpactJson = JSON.parse(readFileSync(resolve(expectedDir, 'minimum-impact.json'), 'utf-8'));

    // 5. Evaluate
    const evaluation = evaluateLlmImpact(
      'nestjs-order-inventory',
      provider.providerName,
      changeRequest,
      result.data,
      retrievalResult.artifacts,
      minimumImpactJson
    );
    console.log('LLM Raw Output:', JSON.stringify(result.data, null, 2));

    // 6. Generate Report
    const reportPath = resolve(__dirname, 'reports');
    try { mkdirSync(reportPath, { recursive: true }); } catch (e) {}
    
    let modelName = 'unknown';
    if (runRealLlm && process.env.AI_PROVIDER === 'google') modelName = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
    if (runRealLlm && process.env.AI_PROVIDER === 'openai') modelName = process.env.OPENAI_MODEL || 'gpt-4o';
    
    const finalReport = {
      promptVersion: 'impact-analysis-v2',
      provider: provider.providerName,
      model: modelName,
      parseMode: result.metadata?.parseMode || 'raw',
      fixture: 'nestjs-order-inventory',
      totalMismatches: evaluation.totalMismatches,
      mismatches: evaluation.mismatches
    };

    writeFileSync(
      resolve(reportPath, `order-inventory-llm-${provider.providerName}-impact-analysis-v2.json`),
      JSON.stringify(finalReport, null, 2)
    );

    if (evaluation.mismatches.length > 0) {
      console.log('LLM Mismatches:', JSON.stringify(evaluation.mismatches, null, 2));
    }

    // 7. Assert
    if (process.env.BENCHMARK_MODE === 'strict') {
      expect(evaluation.mismatches).toHaveLength(0);
    }
  }, 60000);
});
