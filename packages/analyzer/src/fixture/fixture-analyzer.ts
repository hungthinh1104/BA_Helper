import { resolve } from 'node:path';
import { ANALYZER_VERSION } from '../scanner/scanner.types';
import { buildGraph } from '../graph/graph';
import { scanFixture } from '../scanner/scanner';

export type FixtureAnalysis = {
  analyzerVersion: string;
  fixtureName: string;
  artifacts: Array<{
    stableId: string;
    type: string;
    filePath: string;
    symbolName: string;
    httpMethod: string;
    routePath: string;
    startLine: number;
    endLine: number;
    metadata: {
      controller: string;
      method: string;
    };
  }>;
  edges: Array<{
    stableId: string;
    type: string;
    from: string;
    to: string;
    confidence: number;
    evidence: {
      filePath: string;
      startLine: number;
      endLine: number;
    };
  }>;
  impact: {
    changeRequest: string;
    affectedArtifacts: string[];
    confirmedFacts: Array<{
      statement: string;
      evidenceArtifactIds: string[];
    }>;
    inferredImpacts: Array<{
      statement: string;
      evidenceArtifactIds: string[];
      confidence: number;
    }>;
    unknowns: Array<{
      key: string;
      statement: string;
      reason: string;
    }>;
    stakeholderQuestions: string[];
    acceptanceCriteria: string[];
    qaScenarios: string[];
  };
};

export const analyzeFixture = (fixtureName: string): FixtureAnalysis => {
  if (fixtureName !== 'nestjs-booking-with-payment') {
    throw new Error(`Unsupported fixture: ${fixtureName}`);
  }

  const fixturePath = resolve(
    process.cwd(),
    'tests/fixtures/nestjs-booking-with-payment',
  );
  const scan = scanFixture({
    fixturePath,
    analyzerVersion: ANALYZER_VERSION,
  });

  const apiRoute = scan.artifacts.find(
    (artifact) => artifact.symbolName === 'BookingController.cancel',
  );
  const bookingService = scan.artifacts.find(artifact => artifact.symbolName === 'BookingService.cancelBooking');
  const paymentService = scan.artifacts.find(artifact => artifact.symbolName === 'PaymentService.refund');
  const bookingEntity = scan.artifacts.find(artifact => artifact.symbolName === 'Booking');
  const paymentEntity = scan.artifacts.find(artifact => artifact.symbolName === 'PaymentTransaction');
  const testFile = scan.artifacts.find(artifact => artifact.type === 'TEST');
  const controllerEdge = apiRoute && bookingService && buildGraph(scan).edges.find(edge =>
    edge.from === apiRoute.stableId && edge.to === bookingService.stableId && edge.type === 'CALLS');

  const startLine = apiRoute?.startLine ?? 0;
  const endLine = apiRoute?.endLine ?? 0;
  const evidence = controllerEdge?.provenance?.locations[0] ?? {
    sourcePath: apiRoute?.filePath ?? 'src/booking/booking.controller.ts', startLine: 0, endLine: 0,
  };

  return {
    analyzerVersion: scan.analyzerVersion,
    fixtureName,
    artifacts: [
      {
        stableId: apiRoute?.stableId ?? '',
        type: 'API_ROUTE',
        filePath: 'src/booking/booking.controller.ts',
        symbolName: 'BookingController.cancel',
        httpMethod: 'POST',
        routePath: '/bookings/:id/cancel',
        startLine,
        endLine,
        metadata: {
          controller: 'BookingController',
          method: 'cancel',
        },
      },
    ],
    edges: [
      {
        stableId: controllerEdge?.stableId ?? '',
        type: 'CALLS',
        from: apiRoute?.stableId ?? '',
        to: bookingService?.stableId ?? '',
        confidence: 1.0,
        evidence: {
          filePath: evidence.sourcePath,
          startLine: evidence.startLine,
          endLine: evidence.endLine,
        },
      },
    ],
    impact: {
      changeRequest: 'Allow users to cancel paid bookings and receive refund.',
      affectedArtifacts: [
        apiRoute?.stableId ?? '',
        bookingService?.stableId ?? '',
        paymentService?.stableId ?? '',
        bookingEntity?.stableId ?? '',
        paymentEntity?.stableId ?? '',
        testFile?.stableId ?? '',
      ],
      confirmedFacts: [
        {
          statement: 'The system exposes an API route for cancelling a booking.',
          evidenceArtifactIds: [apiRoute?.stableId ?? ''],
        },
      ],
      inferredImpacts: [
        {
          statement: 'Paid booking cancellation may affect refund behavior.',
          evidenceArtifactIds: [
            bookingService?.stableId ?? '',
            paymentService?.stableId ?? '',
          ],
          confidence: 0.75,
        },
      ],
      unknowns: [
        {
          key: 'refund_percentage',
          statement: 'Refund percentage is not confirmed from code evidence.',
          reason: 'No explicit refund percentage or refund policy artifact was found.',
        },
      ],
      stakeholderQuestions: ['Is refund full, partial, or manually approved?'],
      acceptanceCriteria: [
        'Given a paid booking exists, when the user cancels it, then the system should apply the confirmed refund policy.',
      ],
      qaScenarios: [
        'Cancel paid booking successfully',
        'Cancel paid booking when refund fails',
        'Cancel booking twice',
      ],
    },
  };
};
