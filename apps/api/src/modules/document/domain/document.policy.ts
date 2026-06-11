export const DocumentPolicy = {
  canGenerate: (analysisStatus: string, coverageWarning?: boolean) => {
    if (analysisStatus !== 'COMPLETED') {
      return {
        allowed: false,
        reason: 'Document can only be generated for a completed analysis.',
      };
    }
    
    if (coverageWarning) {
      return {
        allowed: true,
        warning: 'Analysis has coverage warnings. Document might be incomplete.',
      };
    }

    return { allowed: true };
  },
};
