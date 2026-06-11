export const normalizeString = (str: string): string => {
  return str.toLowerCase()
    .replace(/[_-]/g, ' ')
    .replace(/[^\w\s]/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
};

export const matchesConcept = (text: string, expectedConcept: string): boolean => {
  const normalizedText = normalizeString(text);
  const normalizedConcept = normalizeString(expectedConcept);
  return normalizedText.includes(normalizedConcept);
};

export const computeArtifactRecall = (expectedKeys: string[], foundKeys: string[]): { score: number; missing: string[] } => {
  if (expectedKeys.length === 0) return { score: 1, missing: [] };
  
  const foundSet = new Set(foundKeys);
  const matched = expectedKeys.filter(k => foundSet.has(k));
  const missing = expectedKeys.filter(k => !foundSet.has(k));
  
  return {
    score: matched.length / expectedKeys.length,
    missing,
  };
};

export const computeArtifactPrecision = (expectedKeys: string[], foundKeys: string[]): { score: number; unexpected: string[] } => {
  if (foundKeys.length === 0) return { score: 1, unexpected: [] };
  
  const expectedSet = new Set(expectedKeys);
  const unexpected = foundKeys.filter(k => !expectedSet.has(k));
  
  return {
    score: (foundKeys.length - unexpected.length) / foundKeys.length,
    unexpected,
  };
};

export const computeEvidenceCoverage = (expectedKeys: string[], foundKeys: string[], evidenceByArtifactKey: Record<string, string[]>): number => {
  const expectedSet = new Set(expectedKeys);
  const correctlyFound = foundKeys.filter(k => expectedSet.has(k));
  if (correctlyFound.length === 0) return 0;
  
  let evidenceCount = 0;
  for (const k of correctlyFound) {
    if (evidenceByArtifactKey[k] && evidenceByArtifactKey[k].length > 0) {
      evidenceCount++;
    }
  }
  
  return evidenceCount / correctlyFound.length;
};

export const computeNegativeControl = (negativeKeys: string[], foundKeys: string[]): { passed: boolean; failedKeys: string[] } => {
  const foundSet = new Set(foundKeys);
  const failedKeys = negativeKeys.filter(k => foundSet.has(k));
  return {
    passed: failedKeys.length === 0,
    failedKeys,
  };
};

export const computeConceptCoverage = (expectedConcepts: string[] | undefined, actualTexts: string[]): { score: number; matched: number; total: number } => {
  if (!expectedConcepts || expectedConcepts.length === 0) return { score: 1, matched: 0, total: 0 };
  
  let matched = 0;
  for (const concept of expectedConcepts) {
    if (actualTexts.some(text => matchesConcept(text, concept))) {
      matched++;
    }
  }
  
  return {
    score: matched / expectedConcepts.length,
    matched,
    total: expectedConcepts.length,
  };
};

export const computeConceptRecall = (expectedConceptKeys: string[] | undefined, matchedConceptKeys: string[] | undefined): { score: number; missing: string[]; matched: string[] } => {
  if (!expectedConceptKeys || expectedConceptKeys.length === 0) return { score: 1, missing: [], matched: [] };
  
  const matchedSet = new Set(matchedConceptKeys || []);
  const matched = expectedConceptKeys.filter(k => matchedSet.has(k));
  const missing = expectedConceptKeys.filter(k => !matchedSet.has(k));
  
  return {
    score: matched.length / expectedConceptKeys.length,
    missing,
    matched,
  };
};

export const computeConceptPrecision = (expectedConceptKeys: string[] | undefined, matchedConceptKeys: string[] | undefined): { score: number; unexpected: string[]; matched: string[] } => {
  if (!matchedConceptKeys || matchedConceptKeys.length === 0) return { score: 1, unexpected: [], matched: [] };
  
  const expectedSet = new Set(expectedConceptKeys || []);
  const unexpected = matchedConceptKeys.filter(k => !expectedSet.has(k));
  const matched = matchedConceptKeys.filter(k => expectedSet.has(k));
  
  return {
    score: (matchedConceptKeys.length - unexpected.length) / matchedConceptKeys.length,
    unexpected,
    matched,
  };
};
