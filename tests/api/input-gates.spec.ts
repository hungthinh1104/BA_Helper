import { RepositoryPolicy } from '../../apps/api/src/modules/repository/domain/repository.policy';
import { RequirementPolicy } from '../../apps/api/src/modules/requirement/domain/requirement.policy';
import { AppError } from '@ba-helper/shared';
import { ScanJobPolicy } from "@ba-helper/application/scanner";

describe('input gate policies', () => {
  const getErrorCode = (fn: () => void) => {
    try {
      fn();
      return null;
    } catch (error) {
      return (error as AppError).code;
    }
  };

  it('accepts and normalizes a valid GitHub URL', () => {
    const normalized = RepositoryPolicy.normalizeUrl(
      'https://github.com/example/booking-api.git',
    );
    expect(normalized.canonicalUrl).toBe(
      'https://github.com/example/booking-api',
    );
  });

  it('rejects non-GitHub hosts', () => {
    const code = getErrorCode(() =>
      RepositoryPolicy.normalizeUrl('https://gitlab.com/example/repo'),
    );
    expect(code).toBe('INVALID_REPOSITORY_URL');
  });

  it('rejects URLs with credentials', () => {
    const code = getErrorCode(() =>
      RepositoryPolicy.normalizeUrl('https://user:pass@github.com/org/repo'),
    );
    expect(code).toBe('INVALID_REPOSITORY_URL');
  });

  it('rejects URLs with query or fragment', () => {
    const code = getErrorCode(() =>
      RepositoryPolicy.normalizeUrl(
        'https://github.com/example/repo?token=abc#readme',
      ),
    );
    expect(code).toBe('INVALID_REPOSITORY_URL');
  });

  it('rejects unsafe ref syntax', () => {
    const code = getErrorCode(() => ScanJobPolicy.validateRef('main..dev'));
    expect(code).toBe('INVALID_REPOSITORY_REF');
  });

  it('rejects requirement text with secrets', () => {
    const code = getErrorCode(() =>
      RequirementPolicy.validateRevisionInput({
        title: 'Secret',
        rawText: 'password=supersecret',
      }),
    );
    expect(code).toBe('INVALID_REQUIREMENT_INPUT');
  });

  it('qualifies vague requirement as needs clarification', () => {
    const readiness = RequirementPolicy.qualifyReadiness('fix it');
    expect(readiness.status).toBe('NEEDS_CLARIFICATION');
  });

  it('qualifies booking cancellation requirement as ready', () => {
    const readiness = RequirementPolicy.qualifyReadiness(
      'Allow users to cancel paid bookings and receive refund.',
    );
    expect(readiness.status).toBe('READY_FOR_ANALYSIS');
  });
});
