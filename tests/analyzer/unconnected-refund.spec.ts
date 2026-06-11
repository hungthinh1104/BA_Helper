import { resolve } from 'node:path';
import { buildGraph, scanFixture, selectEvidenceCandidates } from '../../packages/analyzer/src';

describe('unconnected refund fixture', () => {
  it('selects refund evidence lexically even without a call edge', () => {
    const fixturePath = resolve(
      __dirname,
      '../fixtures/nestjs-booking-unconnected-refund',
    );

    const scan = scanFixture({
      fixturePath,
      analyzerVersion: 'ts-nestjs-analyzer@0.1.0',
    });
    const graph = buildGraph(scan);

    const result = selectEvidenceCandidates({
      changeRequest: 'Allow users to cancel paid bookings and receive refund.',
      scan,
      graph,
      expandGraph: true,
    });

    expect(result.artifacts.map((artifact) => artifact.stableId)).toContain(
      'service-method:payment.service.refund',
    );
  });
});
