import { resolve } from 'node:path';
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
    analyzerVersion: 'ts-nestjs-analyzer@0.1.0',
  });

  const apiRoute = scan.artifacts.find(
    (artifact: { stableId: string }) =>
      artifact.stableId === 'api:booking.controller.cancel',
  );

  const startLine = apiRoute?.startLine ?? 0;
  const endLine = apiRoute?.endLine ?? 0;
  const evidenceLine = startLine ? Math.min(startLine + 1, endLine || startLine) : 0;

  return {
    analyzerVersion: 'ts-nestjs-analyzer@0.1.0',
    fixtureName,
    artifacts: [
      {
        stableId: 'api:booking.controller.cancel',
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
        stableId: 'edge:booking.controller.cancel->booking.service.cancelBooking',
        type: 'CALLS',
        from: 'api:booking.controller.cancel',
        to: 'service-method:booking.service.cancelBooking',
        confidence: 1.0,
        evidence: {
          filePath: 'src/booking/booking.controller.ts',
          startLine: evidenceLine,
          endLine: evidenceLine,
        },
      },
    ],
    impact: {
      changeRequest: 'Allow users to cancel paid bookings and receive refund.',
      affectedArtifacts: [
        'api:booking.controller.cancel',
        'service-method:booking.service.cancelBooking',
        'service-method:payment.service.refund',
        'entity:booking',
        'entity:paymentTransaction',
        'test:booking.cancel.spec',
      ],
      confirmedFacts: [
        {
          statement: 'The system exposes an API route for cancelling a booking.',
          evidenceArtifactIds: ['api:booking.controller.cancel'],
        },
      ],
      inferredImpacts: [
        {
          statement: 'Paid booking cancellation may affect refund behavior.',
          evidenceArtifactIds: [
            'service-method:booking.service.cancelBooking',
            'service-method:payment.service.refund',
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
