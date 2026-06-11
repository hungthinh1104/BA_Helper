import { Project, SyntaxKind } from 'ts-morph';
import { join } from 'node:path';
import type { GraphResult } from './graph.types';
import type { ScanResult } from '../scanner/scanner.types';

const hasCall = (sourceRoot: string, methodName: string, callTarget: string) => {
  const project = new Project({
    useInMemoryFileSystem: false,
    skipFileDependencyResolution: true,
  });
  const filePath = join(sourceRoot, 'src/booking/booking.service.ts');
  const sourceFile = project.addSourceFileAtPathIfExists(filePath);
  if (!sourceFile) return false;
  const cls = sourceFile.getClass('BookingService');
  if (!cls) return false;
  const method = cls.getMethod(methodName);
  if (!method) return false;
  const calls = method.getDescendantsOfKind(SyntaxKind.CallExpression);
  return calls.some((call) => {
    const expression = call.getExpression().getText();
    return expression.includes(callTarget);
  });
};

export const buildGraph = (scan: ScanResult): GraphResult => {
  const hasController = scan.artifacts.some(
    (artifact) => artifact.stableId === 'api:booking.controller.cancel',
  );
  const hasBookingService = scan.artifacts.some(
    (artifact) =>
      artifact.stableId === 'service-method:booking.service.cancelBooking',
  );
  const hasPaymentRefund = scan.artifacts.some(
    (artifact) =>
      artifact.stableId === 'service-method:payment.service.refund',
  );
  const hasSlotRelease = scan.artifacts.some(
    (artifact) =>
      artifact.stableId === 'service-method:slot.service.releaseSlot',
  );
  const hasNotifyOwner = scan.artifacts.some(
    (artifact) =>
      artifact.stableId === 'service-method:notification.service.notifyOwner',
  );

  if (!hasController) {
    return { edges: [] };
  }

  const hasRefundCall = scan.sourceRoot
    ? hasCall(scan.sourceRoot, 'cancelBooking', 'paymentService.refund')
    : hasPaymentRefund;
  const hasSlotCall = scan.sourceRoot
    ? hasCall(scan.sourceRoot, 'cancelBooking', 'slotService.releaseSlot')
    : hasSlotRelease;
  const hasNotifyCall = scan.sourceRoot
    ? hasCall(scan.sourceRoot, 'cancelBooking', 'notificationService.notifyOwner')
    : hasNotifyOwner;

  const edges = [] as GraphResult['edges'];

  if (hasController && hasBookingService) {
    edges.push({
      stableId: 'edge:booking.controller.cancel->booking.service.cancelBooking',
      type: 'CALLS',
      from: 'api:booking.controller.cancel',
      to: 'service-method:booking.service.cancelBooking',
      confidence: 1.0,
    });
  }

  if (hasBookingService && hasPaymentRefund && hasRefundCall) {
    edges.push({
      stableId: 'edge:booking.service.cancelBooking->payment.service.refund',
      type: 'CALLS',
      from: 'service-method:booking.service.cancelBooking',
      to: 'service-method:payment.service.refund',
      confidence: 1.0,
    });
  }

  if (hasBookingService && hasSlotRelease && hasSlotCall) {
    edges.push({
      stableId: 'edge:booking.service.cancelBooking->slot.service.releaseSlot',
      type: 'CALLS',
      from: 'service-method:booking.service.cancelBooking',
      to: 'service-method:slot.service.releaseSlot',
      confidence: 1.0,
    });
  }

  if (hasBookingService && hasNotifyOwner && hasNotifyCall) {
    edges.push({
      stableId:
        'edge:booking.service.cancelBooking->notification.service.notifyOwner',
      type: 'CALLS',
      from: 'service-method:booking.service.cancelBooking',
      to: 'service-method:notification.service.notifyOwner',
      confidence: 1.0,
    });
  }

  return { edges };
};
