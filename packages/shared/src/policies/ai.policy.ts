export const AiPolicy = {
  redactPayload: (payload: string): { redactedPayload: string; hasSecrets: boolean } => {
    // Basic regex for demonstration, similar to EvidencePolicy
    const secretRegex = /(?:api[_-]?key|password|secret|token|credentials)[\s:=]+["'][a-zA-Z0-9_\-\.]+["']/gi;
    let hasSecrets = false;
    const redactedPayload = payload.replace(secretRegex, (match) => {
      hasSecrets = true;
      return match.replace(/["'][a-zA-Z0-9_\-\.]+["']/, '"[REDACTED]"');
    });
    return { redactedPayload, hasSecrets };
  },
};
