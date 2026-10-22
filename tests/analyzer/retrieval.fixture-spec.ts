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

    const expectedKeys = [
      'BookingController.cancel',
      'BookingService.cancelBooking',
      'PaymentService.refund',
      'AdminRefundReportService.generateReport',
    ].map(symbol => scan.artifacts.find(artifact => artifact.symbolName === symbol)!.stableId);
    expectedKeys.push(scan.artifacts.find(artifact => artifact.type === 'JEST_TEST_CASE')!.stableId);
    expectedKeys.push(scan.artifacts.find(artifact => artifact.type === 'TEST')!.stableId);
    const received = result.artifacts.map((a) => a.stableId).sort();
    expect(received).toEqual(expectedKeys.sort());
  });

  it('expands retrieval to related artifacts when enabled', () => {
    const result = selectEvidenceCandidates({
      changeRequest,
      scan,
      graph,
      expandGraph: true,
    });

    const received = result.artifacts.map((a) => a.stableId).sort();
    const expectedKeys = [
      'BookingController.cancel', 'BookingService.cancelBooking', 'PaymentService.refund',
      'AdminRefundReportService.generateReport', 'NotificationService.notifyOwner',
      'SlotService.releaseSlot', 'Booking', 'PaymentTransaction',
    ].map(symbol => scan.artifacts.find(artifact => artifact.symbolName === symbol)!.stableId);
    expectedKeys.push(scan.artifacts.find(artifact => artifact.type === 'JEST_TEST_CASE')!.stableId);
    expectedKeys.push(scan.artifacts.find(artifact => artifact.type === 'TEST')!.stableId);
    expect(received).toEqual(expectedKeys.sort());
  });

  it('does not select keyword-noise artifacts', () => {
    const result = selectEvidenceCandidates({
      changeRequest,
      scan: {
        analyzerVersion: scan.analyzerVersion,
        artifacts: [
          ...scan.artifacts,
          {
            stableId: 'service-method:admin.invoice-report.generateReport',
            type: 'SERVICE_METHOD',
            filePath: 'src/admin/invoice-report.service.ts',
            symbolName: 'AdminInvoiceReportService.generateReport',
            startLine: 3,
            endLine: 5,
            excerpt: '',
          },
        ],
        coverage: scan.coverage,
      },
      graph,
      expandGraph: true,
    });

    expect(result.artifacts.map((artifact) => artifact.stableId)).not.toContain(
      'service-method:admin.invoice-report.generateReport',
    );
  });
});
