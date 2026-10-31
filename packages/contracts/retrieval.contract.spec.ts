import { retrievalMetadataSchema } from './src'

const diagnostics = {
  version: 'retrieval-diagnostics@0.1.0',
  lexicalScoreNorm: 0.62,
  vectorScoreNorm: 0.81,
  graphBoostNorm: 0.2,
  kindBoostNorm: 0.1,
  domainBoostNorm: 0.15,
  matchedIntentLabels: ['API', 'SERVICE'],
  universalKind: 'API_ENDPOINT',
  repositoryProfile: {
    domain: 'BOOKING',
    framework: 'NESTJS',
    language: 'TYPESCRIPT',
    domainPackFallback: false,
  },
  matchedDomainTerms: ['refund'],
  domainPack: {
    id: 'booking',
    version: '0.1.0',
    status: 'STABLE',
    selectedBy: 'REPOSITORY_PROFILE',
  },
  finalScore: 0.84,
} as const

describe('retrieval response contract', () => {
  it('preserves the KIND retrieval signal and validates per-artifact diagnostics', () => {
    const parsed = retrievalMetadataSchema.parse({
      method: 'HYBRID',
      signals: ['VECTOR', 'KIND'],
      score: { final: 0.84 },
      diagnostics,
    })

    expect(parsed.signals).toEqual(['VECTOR', 'KIND'])
    expect(parsed.diagnostics).toEqual(diagnostics)
  })

  it('rejects unsupported retrieval signals and malformed diagnostics', () => {
    expect(retrievalMetadataSchema.safeParse({
      method: 'HYBRID',
      signals: ['MADE_UP_SIGNAL'],
    }).success).toBe(false)
    expect(retrievalMetadataSchema.safeParse({
      method: 'HYBRID',
      diagnostics: { ...diagnostics, vectorScoreNorm: 'high' },
    }).success).toBe(false)
  })
})
