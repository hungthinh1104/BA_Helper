import { RequirementPolicy } from './requirement.policy';

describe('RequirementPolicy', () => {
  describe('qualifyReadiness', () => {
    it('returns NEEDS_CLARIFICATION for extremely vague text', () => {
      const result = RequirementPolicy.qualifyReadiness('fix bug');
      expect(result.status).toBe('NEEDS_CLARIFICATION');
      expect(result.issues).toContain('Requirement text is too vague.');
    });

    it('returns READY_FOR_ANALYSIS for actionable non-booking requirements (regression test)', () => {
      const title = 'Enforce Author-Only Article Mutation';
      const rawText =
        'For the existing article update and delete APIs, only the article author may update or delete the article. If an authenticated user is not the article author, return 403 Forbidden. If the user is not authenticated, keep existing 401 Unauthorized behavior. Do not change create/read/list/feed/tag/favorite behavior.';

      const result = RequirementPolicy.qualifyReadiness(rawText);

      expect(result.status).toBe('READY_FOR_ANALYSIS');
      expect(result.issues).toHaveLength(0);
    });

    it('returns READY_FOR_ANALYSIS for booking requirements', () => {
      const result = RequirementPolicy.qualifyReadiness(
        'Users can cancel and refund their bookings.',
      );

      expect(result.status).toBe('READY_FOR_ANALYSIS');
      expect(result.issues).toHaveLength(0);
    });
  });
});
