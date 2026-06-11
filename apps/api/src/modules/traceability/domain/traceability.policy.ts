export const TraceabilityPolicy = {
  validateLinkDirection: (params: { sourceId: string; targetId: string; linkType: string }) => {
    if (params.sourceId === params.targetId) {
      throw new Error('Self-linking is not allowed.');
    }
    // E.g., a REQUIRES link typically goes from requirement to artifact.
    // E.g., an IMPLEMENTS link goes from artifact to requirement.
    // For now, we just validate it's not a self-link.
    return { valid: true };
  },
};
