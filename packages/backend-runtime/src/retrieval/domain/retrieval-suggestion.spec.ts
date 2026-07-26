import { buildRetrievalSuggestion } from './retrieval-suggestion';

describe('buildRetrievalSuggestion', () => {
  it('returns STRONG confidence for high lexical and graph scores', () => {
    const suggestion = buildRetrievalSuggestion({
      lexicalScore: 0.8,
      graphScore: 0.9,
    });
    expect(suggestion.confidence).toBe('STRONG');
    expect(suggestion.version).toBe('retrieval-suggestion-v1');
  });

  it('returns MODERATE confidence for high graph score and no lexical match', () => {
    const suggestion = buildRetrievalSuggestion({
      lexicalScore: 0,
      graphScore: 0.9,
      vectorScore: 0.3,
    });
    expect(suggestion.confidence).toBe('MODERATE');
  });

  it('returns MODERATE confidence for vector score only', () => {
    const suggestion = buildRetrievalSuggestion({
      lexicalScore: 0,
      graphScore: 0,
      vectorScore: 0.8,
    });
    expect(suggestion.confidence).toBe('MODERATE');
  });

  it('returns WEAK confidence for graph connection only', () => {
    const suggestion = buildRetrievalSuggestion({
      lexicalScore: 0,
      graphScore: 0.5,
      vectorScore: 0,
    });
    expect(suggestion.confidence).toBe('WEAK');
  });

  it('returns WEAK confidence for low final score', () => {
    const suggestion = buildRetrievalSuggestion({
      lexicalScore: 0.2,
      graphScore: 0.1,
      vectorScore: 0.2,
      finalScore: 0.25,
    });
    expect(suggestion.confidence).toBe('WEAK');
  });
});
