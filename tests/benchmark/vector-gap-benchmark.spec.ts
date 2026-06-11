import { resolve } from 'node:path';
import { writeFileSync, mkdirSync } from 'node:fs';
import { scanFixture, buildGraph, selectEvidenceCandidates } from '../../packages/analyzer/src';

interface VectorGapCase {
  changeRequest: string;
  retrievedArtifactKeys: string[];
  missingCriticalArtifacts: string[];
  failures: any[];
}

interface VectorGapReport {
  fixture: string;
  retriever: string;
  cases: VectorGapCase[];
  summary: {
    totalCases: number;
    casesWithMisses: number;
    criticalMissCount: number;
  };
}

describe('Vector Gap Diagnostic Benchmark', () => {
  const fixturePath = resolve(__dirname, '../fixtures/nestjs-order-inventory');
  const reportDir = resolve(__dirname, 'reports');

  it('diagnoses semantic gaps in deterministic retrieval', () => {
    // 1. Run scanner and graph builder
    const scanResult = scanFixture({
      fixturePath,
      analyzerVersion: 'ts-nestjs-analyzer@0.1.0',
    });
    const graphResult = buildGraph(scanResult);

    // 2. Define paraphrased cases and their expected artifacts
    const paraphraseCases = [
      "Allow customers to abort a purchase before fulfillment and restore reserved stock.",
      "When an order is withdrawn, return held inventory back to availability.",
      "Prevent shipment and rollback stock reservation when cancellation happens."
    ];

    const expectedCriticalArtifacts = [
      'service-method:order.service.cancelOrder',
      'service-method:inventory.service.releaseReservation',
      'entity:stockreservation',
      'entity:order'
    ];

    const report: VectorGapReport = {
      fixture: 'nestjs-order-inventory',
      retriever: 'deterministic-lexical-graph',
      cases: [],
      summary: {
        totalCases: paraphraseCases.length,
        casesWithMisses: 0,
        criticalMissCount: 0
      }
    };

    let totalMismatches = 0;

    for (const changeRequest of paraphraseCases) {
      const retrievalResult = selectEvidenceCandidates({
        changeRequest,
        scan: scanResult,
        graph: graphResult,
        expandGraph: true
      });

      const actualKeys = retrievalResult.artifacts.map(a => a.stableId);
      const missingCriticalArtifacts: string[] = [];
      const failures: any[] = [];

      for (const expectedKey of expectedCriticalArtifacts) {
        if (!actualKeys.includes(expectedKey)) {
          missingCriticalArtifacts.push(expectedKey);
          failures.push({
            failureClass: 'RETRIEVAL_MISS',
            reason: 'VECTOR_GAP_DETECTED',
            expected: expectedKey,
            actual: 'Missing',
            details: `Semantic gap: Deterministic pipeline missed ${expectedKey} for paraphrase: "${changeRequest}"`
          });
          totalMismatches++;
        }
      }

      if (missingCriticalArtifacts.length > 0) {
        report.summary.casesWithMisses++;
      }

      report.cases.push({
        changeRequest,
        retrievedArtifactKeys: actualKeys,
        missingCriticalArtifacts,
        failures
      });
    }

    report.summary.criticalMissCount = totalMismatches;

    // 3. Write report
    mkdirSync(reportDir, { recursive: true });
    writeFileSync(
      resolve(reportDir, 'vector-gap-benchmark.json'),
      JSON.stringify(report, null, 2)
    );

    // 4. Log results visually
    console.log('=== Vector Gap Diagnostic Report ===');
    for (const c of report.cases) {
      console.log(`\nQuery: "${c.changeRequest}"`);
      console.log(`Missing Criticals: ${c.missingCriticalArtifacts.length === 0 ? 'None (Perfect)' : c.missingCriticalArtifacts.join(', ')}`);
    }
    console.log('\n====================================');
    console.log(`Total Cases: ${report.summary.totalCases}`);
    console.log(`Cases with Misses: ${report.summary.casesWithMisses}`);
    console.log(`Total Critical Misses: ${report.summary.criticalMissCount}`);

    // 5. Evaluate strict mode
    const isStrict = process.env.STRICT_VECTOR_GAP_BENCHMARK === 'true';
    if (isStrict) {
      // The user specified that if > 2/3 cases miss critical artifacts, it justifies vector.
      // But in strict mode, we expect 0 misses (used after vector is implemented).
      expect(totalMismatches).toBe(0);
    }
  });
});
