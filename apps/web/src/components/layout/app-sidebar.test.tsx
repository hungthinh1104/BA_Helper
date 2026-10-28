import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, jest } from '@jest/globals';

let mockPathname = '/';

jest.mock('next/navigation', () => ({ usePathname: () => mockPathname }));
jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));
jest.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }));
jest.mock('@/i18n/navigation', () => ({ useLocalizedHref: () => (path: string) => path }));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { AppSidebar } = require('./app-sidebar') as typeof import('./app-sidebar');

describe('AppSidebar active navigation', () => {
  afterEach(() => {
    cleanup();
    mockPathname = '/';
  });

  it.each([
    { pathname: '/analyses', activeLink: 'impactAnalyses', inactiveLink: 'multiRepoRuns' },
    { pathname: '/analyses/analysis-1', activeLink: 'impactAnalyses', inactiveLink: 'multiRepoRuns' },
    { pathname: '/analyses/runs', activeLink: 'multiRepoRuns', inactiveLink: 'impactAnalyses' },
    {
      pathname: '/analyses/runs/run-1/merged-report',
      activeLink: 'multiRepoRuns',
      inactiveLink: 'impactAnalyses',
    },
  ])('marks the matching section for $pathname', ({ pathname, activeLink, inactiveLink }) => {
    mockPathname = pathname;
    render(<AppSidebar />);

    expect(screen.getByRole('link', { name: activeLink })).toHaveAttribute('data-active', 'true');
    expect(screen.getByRole('link', { name: inactiveLink })).not.toHaveAttribute('data-active', 'true');
  });
});
