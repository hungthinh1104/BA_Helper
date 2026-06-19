import {
  assertUsableVectorProvider,
} from './vector-provider-gate';

describe('vector provider gate', () => {
  const originalEnv = process.env.REQIMPACT_ALLOW_NETWORK_VECTOR_BASELINE;

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.REQIMPACT_ALLOW_NETWORK_VECTOR_BASELINE;
    } else {
      process.env.REQIMPACT_ALLOW_NETWORK_VECTOR_BASELINE = originalEnv;
    }
  });

  it('rejects fake provider names', () => {
    expect(() =>
      assertUsableVectorProvider({
        providerName: 'FakeEmbeddingProvider',
        embeddingModel: 'fake-v1',
        source: 'local-real',
        allowsNetwork: false,
        isDeterministic: true,
        isFake: false,
      }),
    ).toThrow(/fake providers/i);
  });

  it('rejects hash random and keyword sources', () => {
    for (const source of ['hash', 'random', 'keyword'] as const) {
      expect(() =>
        assertUsableVectorProvider({
          providerName: 'local-provider',
          embeddingModel: 'real-v1',
          source,
          allowsNetwork: false,
          isDeterministic: true,
          isFake: false,
        }),
      ).toThrow(new RegExp(`source=${source}`));
    }
  });

  it('rejects missing embeddingModel', () => {
    expect(() =>
      assertUsableVectorProvider({
        providerName: 'local-provider',
        embeddingModel: '   ',
        source: 'local-real',
        allowsNetwork: false,
        isDeterministic: true,
        isFake: false,
      }),
    ).toThrow(/embeddingModel is required/i);
  });

  it('rejects network provider unless env flag is enabled', () => {
    delete process.env.REQIMPACT_ALLOW_NETWORK_VECTOR_BASELINE;

    expect(() =>
      assertUsableVectorProvider({
        providerName: 'google-embedding',
        embeddingModel: 'text-embedding-004',
        source: 'network-real',
        allowsNetwork: true,
        isDeterministic: false,
        isFake: false,
      }),
    ).toThrow(/REQIMPACT_ALLOW_NETWORK_VECTOR_BASELINE=1/i);
  });

  it('allows documented local real provider config', () => {
    expect(() =>
      assertUsableVectorProvider({
        providerName: 'local-onnx',
        embeddingModel: 'bge-small-en-v1.5',
        source: 'local-real',
        allowsNetwork: false,
        isDeterministic: true,
        isFake: false,
      }),
    ).not.toThrow();
  });

  it('allows documented persisted-db provider config when db mode is available', () => {
    expect(() =>
      assertUsableVectorProvider({
        providerName: 'persisted-embeddingchunk',
        embeddingModel: 'text-embedding-004',
        source: 'persisted-db',
        allowsNetwork: false,
        isDeterministic: true,
        isFake: false,
        dbModeAvailable: true,
      }),
    ).not.toThrow();
  });
});
