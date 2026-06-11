import { resolve } from 'node:path';
import { buildGraph, scanFixture, selectEvidenceCandidates } from '../../packages/analyzer/src';

describe('retrieval fixture expectations', () => {
  const fixturePath = resolve(
    __dirname,
    '../fixtures/nestjs-booking-with-payment',
  );
  const scan = scanFixture({
    fixturePath,
    analyzerVersion: 'ts-nestjs-analyzer@0.1.0',
  });
  const graph = buildGraph(scan);
  const changeRequest = 'Allow users to cancel paid bookings and receive refund.';

  it('retrieves required cancellation/refund artifacts', () => {
    const result = selectEvidenceCandidates({
      changeRequest,
      scan,
      graph,
      expandGraph: false,
    });

    expect(result.artifacts.map((artifact) => artifact.stableId)).toEqual([
      'api:booking.controller.cancel',
      'service-method:booking.service.cancelBooking',
      'service-method:payment.service.refund',
    ]);
  });

  it('expands retrieval to related artifacts when enabled', () => {
    const result = selectEvidenceCandidates({
      changeRequest,
      scan,
      graph,
      expandGraph: true,
    });

    expect(result.artifacts.map((artifact) => artifact.stableId)).toEqual([
      'api:booking.controller.cancel',
      'entity:booking',
      'entity:paymentTransaction',
      'service-method:booking.service.cancelBooking',
      'service-method:notification.service.notifyOwner',
      'service-method:payment.service.refund',
      'service-method:slot.service.releaseSlot',
      'test:booking.cancel.spec',
    ]);
  });

  it('does not select keyword-noise artifacts', () => {
    const result = selectEvidenceCandidates({
      changeRequest,
      scan: {
        analyzerVersion: scan.analyzerVersion,
        artifacts: [
          ...scan.artifacts,
          {
            stableId: 'service-method:admin.refund-report.generateReport',
            type: 'SERVICE_METHOD',
            filePath: 'src/admin/refund-report.service.ts',
            symbolName: 'AdminRefundReportService.generateReport',
            startLine: 3,
            endLine: 5,
          },
        ],
        coverage: scan.coverage,
      },
      graph,
      expandGraph: true,
    });

    expect(result.artifacts.map((artifact) => artifact.stableId)).not.toContain(
      'service-method:admin.refund-report.generateReport',
    );
  });
});
