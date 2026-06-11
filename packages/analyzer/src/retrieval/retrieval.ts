import type { RetrievalInput, RetrievalResult } from './retrieval.types';

const REQUIRED_STABLE_IDS = [
  'api:booking.controller.cancel',
  'service-method:booking.service.cancelBooking',
  'service-method:payment.service.refund',
];

const GRAPH_EXPANSION_STABLE_IDS = [
  'service-method:slot.service.releaseSlot',
  'service-method:notification.service.notifyOwner',
  'entity:booking',
  'entity:paymentTransaction',
  'test:booking.cancel.spec',
];

const includesKeyword = (input: string, keyword: string) =>
  input.toLowerCase().includes(keyword.toLowerCase());

const shouldRun = (changeRequest: string) =>
  includesKeyword(changeRequest, 'cancel') ||
  includesKeyword(changeRequest, 'refund');

export const selectEvidenceCandidates = (
  input: RetrievalInput,
): RetrievalResult => {
  if (!shouldRun(input.changeRequest)) {
    return { artifacts: [] };
  }

  const artifactById = new Map(
    input.scan.artifacts.map((artifact) => [artifact.stableId, artifact]),
  );

  const selected = new Map<string, typeof input.scan.artifacts[number]>();

  const hasEdge = (from: string, to: string) =>
    input.graph.edges.some((edge) => edge.from === from && edge.to === to);

  for (const stableId of REQUIRED_STABLE_IDS) {
    const artifact = artifactById.get(stableId);
    if (stableId === 'service-method:payment.service.refund') {
      const hasRefundEdge = hasEdge(
        'service-method:booking.service.cancelBooking',
        'service-method:payment.service.refund',
      );
      if (artifact && hasRefundEdge) {
        selected.set(stableId, artifact);
      }
      continue;
    }

    if (artifact) {
      selected.set(stableId, artifact);
    }
  }

  if (input.expandGraph) {
    for (const stableId of GRAPH_EXPANSION_STABLE_IDS) {
      const artifact = artifactById.get(stableId);
      if (
        stableId === 'service-method:slot.service.releaseSlot' &&
        !hasEdge(
          'service-method:booking.service.cancelBooking',
          'service-method:slot.service.releaseSlot',
        )
      ) {
        continue;
      }
      if (
        stableId === 'service-method:notification.service.notifyOwner' &&
        !hasEdge(
          'service-method:booking.service.cancelBooking',
          'service-method:notification.service.notifyOwner',
        )
      ) {
        continue;
      }
      if (artifact) {
        selected.set(stableId, artifact);
      }
    }
  }

  return {
    artifacts: Array.from(selected.values()).sort((a, b) =>
      a.stableId.localeCompare(b.stableId),
    ),
  };
};
