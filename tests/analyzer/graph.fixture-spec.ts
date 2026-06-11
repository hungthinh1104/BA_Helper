import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { buildGraph, scanFixture } from '../../packages/analyzer/src';

describe('graph fixture expectations', () => {
  const scan = scanFixture({
    fixturePath: resolve(
      __dirname,
      '../fixtures/nestjs-booking-with-payment',
    ),
    analyzerVersion: 'ts-nestjs-analyzer@0.1.0',
  });

  it('matches expected edges', () => {
    const expectedEdgesPath = resolve(
      __dirname,
      '../fixtures/nestjs-booking-with-payment/expected/edges.json',
    );
    const expectedEdges = JSON.parse(
      readFileSync(expectedEdgesPath, 'utf-8'),
    ) as { edges: ReturnType<typeof buildGraph>['edges'] };
    const edges = buildGraph(scan).edges;

    expect(
      edges.sort((a, b) => a.stableId.localeCompare(b.stableId)),
    ).toEqual(
      expectedEdges.edges.sort((a, b) =>
        a.stableId.localeCompare(b.stableId),
      ),
    );
  });
});
