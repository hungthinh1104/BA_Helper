export function formatArtifactType(type: string): string {
  return type.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
}

export function resolveArtifactDisplayType(artifact?: { artifactType?: string | null; universalKind?: string | null } | null): string {
  if (!artifact) return 'Unknown';
  if (artifact.universalKind) return formatArtifactType(artifact.universalKind);
  if (artifact.artifactType) return formatArtifactType(artifact.artifactType);
  return 'Unknown';
}

export function formatCertainty(certainty: string): string {
  switch (certainty) {
    case 'EVIDENCED': return 'Evidenced';
    case 'INFERRED': return 'Inferred';
    case 'UNKNOWN': return 'Unknown';
    case 'CONFLICTING': return 'Conflicting';
    default: return certainty;
  }
}

export function parseQaScenarioParts(description: string): { precondition: string, action: string, expected: string } {
  let precondition = '-';
  let action = '-';
  let expected = description;
  
  const givenMatch = description.match(/Given (.*?) When /i);
  const whenMatch = description.match(/When (.*?) Then /i);
  const thenMatch = description.match(/Then (.*)/i);
  
  if (givenMatch && whenMatch && thenMatch) {
    precondition = givenMatch[1];
    action = whenMatch[1];
    expected = thenMatch[1];
  }
  
  return { precondition, action, expected };
}
