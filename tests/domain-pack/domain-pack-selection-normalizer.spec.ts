import {
  projectDomainPackSelection,
  readResolvedDomainPackSelection,
  sameResolvedDomainPackSelection,
} from '@ba-helper/application';

describe('domain pack selection normalizer', () => {
  it('prefers first-class columns over stale legacy metadata', () => {
    expect(
      readResolvedDomainPackSelection({
        requestedDomainPackId: 'HEALTHCARE',
        resolvedDomainPackId: 'HEALTHCARE',
        resolvedDomainPackVersion: '0.1.0',
        resolvedDomainPackStatus: 'partial',
        domainPackSelectedBy: 'explicit',
        domainPackResolvedAt: new Date('2026-06-27T00:00:00.000Z'),
        metadata: {
          selectedDomainPack: {
            requestedDomainPackId: 'booking',
            resolvedDomainPackId: 'booking',
            resolvedDomainPackVersion: '0.1.0',
            resolvedDomainPackStatus: 'STABLE',
            selectedBy: 'REPOSITORY_PROFILE',
            resolvedAt: '2026-06-01T00:00:00.000Z',
          },
        },
      }),
    ).toEqual({
      requestedDomainPackId: 'healthcare',
      resolvedDomainPackId: 'healthcare',
      resolvedDomainPackVersion: '0.1.0',
      resolvedDomainPackStatus: 'PARTIAL',
      selectedBy: 'EXPLICIT',
      resolvedAt: '2026-06-27T00:00:00.000Z',
    });
  });

  it.each(['BOOKING', 'booking', 'booking@0.1.0'])(
    'normalizes %s to canonical booking selection',
    (packId) => {
      expect(
        readResolvedDomainPackSelection({
          resolvedDomainPackId: packId,
          resolvedDomainPackVersion: '0.1.0',
          resolvedDomainPackStatus: 'STABLE',
          domainPackSelectedBy: 'REPOSITORY_PROFILE',
        }),
      ).toMatchObject({
        resolvedDomainPackId: 'booking',
        resolvedDomainPackVersion: '0.1.0',
        resolvedDomainPackStatus: 'STABLE',
        selectedBy: 'REPOSITORY_PROFILE',
      });
    },
  );

  it('normalizes lowercase legacy status and selectedBy aliases', () => {
    expect(
      projectDomainPackSelection({
        metadata: {
          domainPack: {
            id: 'ECOMMERCE@0.1.0',
            version: '0.1.0',
            status: 'partial',
            selectedBy: 'manual_config',
          },
        },
      }),
    ).toEqual({
      id: 'ecommerce',
      version: '0.1.0',
      status: 'PARTIAL',
      selectedBy: 'EXPLICIT',
    });
  });

  it.each([
    { resolvedDomainPackStatus: 'SUPPORTED', domainPackSelectedBy: 'EXPLICIT' },
    { resolvedDomainPackStatus: 'PARTIAL', domainPackSelectedBy: 'auto' },
    {
      resolvedDomainPackId: 'booking@9.9.9',
      resolvedDomainPackVersion: '0.1.0',
      resolvedDomainPackStatus: 'STABLE',
      domainPackSelectedBy: 'EXPLICIT',
    },
  ])('rejects invalid domain pack selection %j', (override) => {
    expect(
      readResolvedDomainPackSelection({
        resolvedDomainPackId: 'booking',
        resolvedDomainPackVersion: '0.1.0',
        ...override,
      }),
    ).toBeNull();
  });

  it('compares equivalent selections after canonicalization and ignores resolvedAt', () => {
    expect(
      sameResolvedDomainPackSelection(
        {
          requestedDomainPackId: 'HEALTHCARE@0.1.0',
          resolvedDomainPackId: 'HEALTHCARE',
          resolvedDomainPackVersion: '0.1.0',
          resolvedDomainPackStatus: 'partial',
          selectedBy: 'manual_config',
          resolvedAt: '2026-06-01T00:00:00.000Z',
        } as any,
        {
          requestedDomainPackId: 'healthcare',
          resolvedDomainPackId: 'healthcare@0.1.0',
          resolvedDomainPackVersion: '0.1.0',
          resolvedDomainPackStatus: 'PARTIAL',
          selectedBy: 'EXPLICIT',
          resolvedAt: '2026-06-02T00:00:00.000Z',
        },
      ),
    ).toBe(true);
  });

  it('ignores unresolved default fallback columns only when requested by worker compatibility path', () => {
    const record = {
      requestedDomainPackId: null,
      resolvedDomainPackId: 'general',
      resolvedDomainPackVersion: '0.0.0',
      resolvedDomainPackStatus: 'FALLBACK',
      domainPackSelectedBy: 'FALLBACK',
      metadata: null,
    };

    expect(readResolvedDomainPackSelection(record)).toMatchObject({
      resolvedDomainPackId: 'general',
      resolvedDomainPackVersion: '0.0.0',
      resolvedDomainPackStatus: 'FALLBACK',
    });
    expect(
      readResolvedDomainPackSelection(record, {
        ignoreUnresolvedDefaultFallback: true,
      }),
    ).toBeNull();
  });
});
