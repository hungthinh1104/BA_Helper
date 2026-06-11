import { RetrievedArtifact } from './retrieval.types';

export interface RetrievalSuggestion {
  version: string;
  confidence: 'STRONG' | 'MODERATE' | 'WEAK';
  why: string;
  suggestedAction: string;
  qaFocus?: string;
  baQuestion?: string;
  risk?: string;
}

export function buildRetrievalSuggestion(artifact: Pick<RetrievedArtifact, 'lexicalScore' | 'graphScore' | 'vectorScore' | 'finalScore'>): RetrievalSuggestion {
  const lexical = artifact.lexicalScore ?? 0;
  const graph = artifact.graphScore ?? 0;
  const vector = artifact.vectorScore ?? 0;
  const final = artifact.finalScore ?? 0;

  const version = 'retrieval-suggestion-v1';

  if (lexical >= 0.5 && graph >= 0.5) {
    return {
      version,
      confidence: 'STRONG',
      why: 'This artifact directly matches the requirement wording and is connected in the dependency graph.',
      suggestedAction: 'Prioritize this item for review.',
      qaFocus: 'Create or verify tests around this primary impacted path.',
      risk: 'Low retrieval risk, but still confirm the code evidence before approval.',
    };
  }

  if (graph >= 0.8 && lexical === 0 && vector > 0.25) {
    return {
      version,
      confidence: 'MODERATE',
      why: 'This artifact was selected mainly because it is connected through the dependency graph. The semantic match is present but not strong, and there was no direct keyword match.',
      suggestedAction: 'Review the connected call path before confirming this impact.',
      baQuestion: 'Is this dependency part of the intended change scope, or only an implementation detail?',
      qaFocus: 'Add or check regression tests for the upstream flow that reaches this artifact.',
      risk: 'No direct wording match was found, so this should not be confirmed without reading the evidence.',
    };
  }

  if (vector >= 0.7 && lexical === 0 && graph === 0) {
    return {
      version,
      confidence: 'MODERATE',
      why: 'This artifact was selected by semantic similarity only.',
      suggestedAction: 'Treat this as tentative and confirm manually before accepting.',
      qaFocus: 'Check whether the behavior is actually reachable from the changed requirement.',
      risk: 'No graph path currently supports this match.',
    };
  }

  if (graph > 0 && lexical === 0 && vector === 0) {
    return {
      version,
      confidence: 'WEAK',
      why: 'This artifact was selected only because it is connected to another impacted artifact.',
      suggestedAction: 'Confirm whether this dependency is actually executed in the changed flow.',
      qaFocus: 'Test for indirect side effects if this dependency is part of the runtime path.',
      risk: 'There is no direct keyword or semantic match.',
    };
  }

  if (final < 0.3) {
    return {
      version,
      confidence: 'WEAK',
      why: 'The retrieval signal is generally weak across all methods.',
      suggestedAction: 'Verify if this artifact is truly impacted before accepting.',
      qaFocus: 'Ensure not to add false-positive regression tests if this is unrelated.',
      risk: 'High risk of false positive due to weak signal.',
    };
  }

  return {
    version,
    confidence: 'MODERATE',
    why: 'This artifact was selected with moderate combined signals across various methods.',
    suggestedAction: 'Review evidence to confirm impact before proceeding.',
    qaFocus: 'If confirmed, review related coverage gaps.',
  };
}
