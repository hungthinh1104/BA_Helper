import { resolve } from 'node:path';
import { readFileSync } from 'node:fs';
import { scanFixture, buildGraph, selectEvidenceCandidates } from '../../packages/analyzer/src';

// @ts-ignore
import { BenchmarkFailureClass, BenchmarkMismatch, BenchmarkReport } from './benchmark-types';

describe('Order/Inventory Benchmark', () => {
  const fixturePath = resolve(__dirname, '../fixtures/nestjs-order-inventory');
  const expectedDir = resolve(fixturePath, 'expected');

  it('scanner captures expected artifacts and edges', () => {
    const expectedScanArtifacts = JSON.parse(readFileSync(resolve(expectedDir, 'scan-artifacts.json'), 'utf-8'));
    const expectedGraphEdges = JSON.parse(readFileSync(resolve(expectedDir, 'graph-edges.json'), 'utf-8'));

    const result = scanFixture({
      fixturePath,
      analyzerVersion: 'ts-nestjs-analyzer@0.1.0',
    });

    const mismatches: BenchmarkMismatch[] = [];
    const actualKeys = new Set(result.artifacts.map(a => a.stableId));

    for (const exp of expectedScanArtifacts.artifacts) {
      if (!actualKeys.has(exp.stableId)) {
        mismatches.push({
          failureClass: BenchmarkFailureClass.SCANNER_MISS,
          expected: exp.stableId,
          actual: 'Missing',
          details: `Artifact ${exp.stableId} was not found by the scanner.`,
        });
      }
    }

    const graphResult = buildGraph(result);
    const actualEdges = new Set(graphResult.edges.map(e => `${e.from} -> ${e.type} -> ${e.to}`));
    
    for (const exp of expectedGraphEdges.edges) {
      const edgeKey = `${exp.from} -> ${exp.type} -> ${exp.to}`;
      if (!actualEdges.has(edgeKey)) {
        mismatches.push({
          failureClass: BenchmarkFailureClass.GRAPH_EDGE_MISS,
          expected: edgeKey,
          actual: 'Missing',
          details: `Graph edge ${edgeKey} was not extracted.`,
        });
      }
    }

    if (mismatches.length > 0) {
      console.log('Scanner Mismatches:', JSON.stringify(mismatches, null, 2));
    }

    // In a benchmark, we want to know if it passes the minimum scanner check.
    // We expect the scanner to work completely. If it doesn't, we can fail the test.
    if (process.env.BENCHMARK_MODE === 'strict') {
      expect(mismatches).toHaveLength(0);
    }
  });

  it('retrieves expected evidence without noise', () => {
    const expectedRetrieval = JSON.parse(readFileSync(resolve(expectedDir, 'retrieval-results.json'), 'utf-8'));
    
    // Simulate what the pipeline does
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

    const mismatches: BenchmarkMismatch[] = [];
    const actualKeys = retrievalResult.artifacts.map(a => a.stableId);

    // 1. Check for Missing Critical Artifacts
    for (const exp of expectedRetrieval.results) {
      if (!actualKeys.includes(exp.artifactKey)) {
        mismatches.push({
          failureClass: BenchmarkFailureClass.RETRIEVAL_MISS,
          expected: exp.artifactKey,
          actual: 'Missing',
          details: `Critical artifact ${exp.artifactKey} was not retrieved.`,
        });
      }
    }

    // 2. Check for Noise Artifacts (Deliberate false positives)
    const noiseArtifacts = [
      'service-method:discount.service.applyDiscount',
      'service-method:product-recommendation.service.getRecommendations',
      'service-method:shipment.service.trackShipment'
    ];

    noiseArtifacts.forEach(noiseKey => {
      const rank = actualKeys.indexOf(noiseKey);
      if (rank !== -1) {
        if (rank < 5) {
          mismatches.push({
            failureClass: BenchmarkFailureClass.RANKING_WEAK,
            expected: `Noise below top 5 or excluded`,
            actual: `Rank ${rank + 1}`,
            details: `Noise artifact ${noiseKey} ranked too high (Rank ${rank + 1}).`,
          });
        } else {
          mismatches.push({
            failureClass: BenchmarkFailureClass.RETRIEVAL_NOISE,
            expected: `Excluded`,
            actual: `Rank ${rank + 1}`,
            details: `Noise artifact ${noiseKey} was retrieved.`,
          });
        }
      }
    });

    if (mismatches.length > 0) {
      console.log('Retrieval Mismatches:', JSON.stringify(mismatches, null, 2));
    }

    if (process.env.BENCHMARK_MODE === 'strict') {
      expect(mismatches).toHaveLength(0);
    }
  });
});
