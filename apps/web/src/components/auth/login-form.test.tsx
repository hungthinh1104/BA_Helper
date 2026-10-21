import { render, screen } from '@testing-library/react';
import { useAuth } from '@/hooks/use-auth';
import { LoginForm } from './login-form';

jest.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams() }));
jest.mock('@/hooks/use-auth', () => ({ useAuth: jest.fn() }));
jest.mock('@/components/theme-toggle', () => ({ ThemeToggle: () => null }));

it('keeps credentials disabled until the client auth session is ready', () => {
  const auth = { login: jest.fn(), isLoading: true } as unknown as ReturnType<typeof useAuth>;
  jest.mocked(useAuth).mockReturnValue(auth);
  const view = render(<LoginForm />);
  expect(screen.getByLabelText('Email')).toBeDisabled();
  expect(screen.getByLabelText('Password')).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Sign In' })).toBeDisabled();
  jest.mocked(useAuth).mockReturnValue({ ...auth, isLoading: false });
  view.rerender(<LoginForm />);
  expect(screen.getByLabelText('Email')).toBeEnabled();
  expect(screen.getByLabelText('Password')).toBeEnabled();
  expect(screen.getByRole('button', { name: 'Sign In' })).toBeEnabled();
});
