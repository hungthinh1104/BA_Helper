import { fireEvent, render, screen } from '@testing-library/react';
import { CodeEvidenceNavigator } from './code-evidence-navigator';

const useSnapshotArtifacts = jest.fn();
let artifactQuery: unknown;
jest.mock('@/hooks/api/use-code-comprehension', () => ({ useSnapshotArtifacts: (...args: unknown[]) => {
  useSnapshotArtifacts(...args);
  return artifactQuery;
} }));
jest.mock('@/i18n/navigation', () => ({ useLocalizedHref: () => (path: string) => path }));

describe('CodeEvidenceNavigator', () => {
  it('keeps the artifact index lazy and links supported production artifacts to comprehension', () => {
    artifactQuery = { isLoading: false, isError: false, data: {
      items: [
        { id: '00000000-0000-4000-8000-000000000001', artifactKey: 'service:run', name: 'Service.run', artifactType: 'SERVICE_METHOD', universalKind: 'DOMAIN_SERVICE', filePath: 'src/service.ts', startLine: 10, endLine: 20, language: 'typescript', testCase: undefined },
        { id: '00000000-0000-4000-8000-000000000002', artifactKey: 'test:run', name: 'runs', artifactType: 'JEST_TEST_CASE', universalKind: 'TEST_CASE', filePath: 'src/service.spec.ts', startLine: 5, endLine: 8, language: 'typescript', testCase: undefined },
      ],
    } };

    render(<CodeEvidenceNavigator repositoryId="repo-1" snapshotId="snapshot-1" />);
    expect(useSnapshotArtifacts).toHaveBeenCalledWith('snapshot-1', false);
    fireEvent.click(screen.getByRole('button', { name: 'Code evidence' }));

    expect(screen.getByText('Service.run')).toBeInTheDocument();
    expect(screen.queryByText('runs')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Service\.run/ })).toHaveAttribute(
      'href', '/repositories/repo-1/snapshots/snapshot-1/artifacts/00000000-0000-4000-8000-000000000001',
    );
    expect(useSnapshotArtifacts).toHaveBeenCalledWith('snapshot-1', true);
  });

  it('reports the no-snapshot state without issuing an artifact request', () => {
    artifactQuery = { isLoading: false, isError: false, data: undefined };
    render(<CodeEvidenceNavigator repositoryId="repo-1" />);
    expect(screen.getByText(/usable snapshot is required/i)).toBeInTheDocument();
    expect(useSnapshotArtifacts).toHaveBeenCalledWith(undefined, false);
  });
});
