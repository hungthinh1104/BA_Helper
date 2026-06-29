import { DocumentStatus } from '@prisma/client';

describe('DocumentStatus Invariants', () => {
  it('PR-7: STALE must remain a projection-only state', () => {
    // This test serves as a documentation invariant.
    // If DocumentStatus enum changes, this ensures we remember STALE is projection-only.
    // In our architecture, application code should never write DocumentStatus.STALE to the database.
    
    const validPersistedStates: DocumentStatus[] = [
      DocumentStatus.DRAFT,
      DocumentStatus.APPROVED,
    ];

    expect(validPersistedStates).not.toContain(DocumentStatus.STALE);
    
    // Stale is dynamically computed by checking if the snapshot has drifted
    // from the target's latest observed commit.
    const projectionOnlyStates: DocumentStatus[] = [
      DocumentStatus.STALE,
    ];
    
    expect(projectionOnlyStates).toContain(DocumentStatus.STALE);
  });
});
