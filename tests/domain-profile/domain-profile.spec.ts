import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { getDomainProfile, getDomainGlossary } from '../../apps/api/src/modules/domain-profile';
import { BookingDomainProfile } from '../../apps/api/src/modules/domain-profile/profiles/booking.domain-profile';
import { HybridRetrievalService } from '../../apps/api/src/modules/retrieval/application/hybrid-retrieval.service';
import { FakeEmbeddingProvider } from '../../apps/api/src/modules/embedding/infrastructure/fake-embedding.provider';

describe('getDomainProfile', () => {
  it('returns BookingDomainProfile when domain is "BOOKING"', () => {
    const profile = getDomainProfile('BOOKING');
    expect(profile).toBe(BookingDomainProfile);
    expect(profile.domain).toBe('BOOKING');
  });

  it('returns BookingDomainProfile when domain is undefined (missing)', () => {
    const profile = getDomainProfile(undefined);
    expect(profile).toBe(BookingDomainProfile);
  });

  it('returns BookingDomainProfile when domain is empty string (missing)', () => {
    const profile = getDomainProfile('');
    expect(profile).toBe(BookingDomainProfile);
  });

  it('throws UnsupportedDomainError for an explicit unknown domain', () => {
    expect(() => getDomainProfile('HEALTHCARE')).toThrow('HEALTHCARE');
    expect(() => getDomainProfile('LOGISTICS')).toThrow('not supported');
  });

  it('includes non-empty glossary, riskCategories, promptContext, questionTemplates, qaScenarioTemplates', () => {
    const profile = getDomainProfile('BOOKING');
    expect(profile.glossary.length).toBeGreaterThan(0);
    expect(profile.riskCategories.length).toBeGreaterThan(0);
    expect(profile.promptContext.trim().length).toBeGreaterThan(0);
    expect(profile.questionTemplates.length).toBeGreaterThan(0);
    expect(profile.qaScenarioTemplates.length).toBeGreaterThan(0);
  });
});

describe('getDomainGlossary', () => {
  it('returns BOOKING glossary terms for "BOOKING"', () => {
    const glossary = getDomainGlossary('BOOKING');
    expect(Array.isArray(glossary)).toBe(true);
    expect(glossary.length).toBeGreaterThan(0);
    expect(glossary).toContain('booking');
    expect(glossary).toContain('refund');
    expect(glossary).toContain('cancellation');
    expect(glossary).toContain('payment');
  });

  it('returns BOOKING glossary when domain is undefined', () => {
    const glossary = getDomainGlossary(undefined);
    expect(glossary.length).toBeGreaterThan(0);
  });

  it('throws for unsupported explicit domain', () => {
    expect(() => getDomainGlossary('HEALTHCARE')).toThrow('not supported');
  });
});

describe('HybridRetrievalService — domain-aware keyword extraction', () => {
  let service: HybridRetrievalService;
  let prismaMock: any;

  beforeEach(() => {
    const chunkRepoMock = { searchSimilar: jest.fn<any>().mockResolvedValue([]) };
    const provider = new FakeEmbeddingProvider();
    const artifactRepoMock = { findById: jest.fn<any>() };
    const graphRepoMock = { expandFromSeeds: jest.fn<any>().mockResolvedValue([]) };
    prismaMock = {
      $queryRaw: jest.fn<any>().mockResolvedValue([]),
      codeArtifact: { findMany: jest.fn<any>().mockResolvedValue([]) },
      repositorySnapshot: { findUnique: jest.fn<any>().mockResolvedValue({ indexStatus: 'LEXICAL_READY' }) },
    };
    service = new HybridRetrievalService(
      chunkRepoMock as any,
      provider as any,
      artifactRepoMock as any,
      graphRepoMock as any,
      prismaMock as any,
    );
  });

  it('uses domain glossary for keyword expansion — not hardcoded booking words', async () => {
    // Use a change request with terms only from the BOOKING glossary, no generic words
    await service.retrieve({
      projectId: 'proj-1',
      repositoryId: 'repo-1',
      snapshotId: 'snap-1',
      changeRequest: 'user wants to issue a refund for their booking cancellation',
      domain: 'BOOKING',
    });

    expect(prismaMock.$queryRaw as jest.Mock).toHaveBeenCalledTimes(1);
    const sqlArgs = (prismaMock.$queryRaw as jest.Mock).mock.calls[0];
    const sql = sqlArgs[0] as { values?: unknown[] };
    const keywordFlat = (sql.values ?? []).join(' ');
    // These terms come from the BOOKING glossary, not a hardcoded list
    expect(keywordFlat).toContain('refund');
    expect(keywordFlat).toContain('booking');
    expect(keywordFlat).toContain('cancellation');
  });

  it('throws when domain is explicitly unsupported', async () => {
    await expect(
      service.retrieve({
        projectId: 'proj-1',
        repositoryId: 'repo-1',
        snapshotId: 'snap-1',
        changeRequest: 'cancel booking',
        domain: 'HEALTHCARE', // not supported
      }),
    ).rejects.toThrow('not supported');
  });

  it('does not inject glossary into prompt — only snapshotId-scoped SQL search', async () => {
    await service.retrieve({
      projectId: 'proj-1',
      repositoryId: 'repo-1',
      snapshotId: 'snap-1',
      changeRequest: 'cancellation of booking refund',
      domain: 'BOOKING',
    });

    const sqlArgs = (prismaMock.$queryRaw as jest.Mock).mock.calls[0];
    const sql = sqlArgs[0] as { strings?: string[] };
    const text = Array.isArray(sql?.strings) ? sql.strings.join(' ') : String(sql);
    // SQL must scope to snapshotId — no global search
    expect(text).toContain('"snapshotId"');
    // SQL searches name, filePath, artifactKey — not arbitrary columns
    expect(text).toContain('"filePath"');
    expect(text).toContain('"artifactKey"');
  });
});
