import { render, screen } from '@testing-library/react';
import { loginWithCredentials } from '@/lib/auth-client';
import { LoginForm } from './login-form';

jest.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams() }));
jest.mock('@/lib/auth-client', () => ({ loginWithCredentials: jest.fn() }));
jest.mock('@/components/theme-toggle', () => ({ ThemeToggle: () => null }));

it('allows credentials as soon as the login form handlers are attached', () => {
  jest.mocked(loginWithCredentials).mockResolvedValue({ ok: true });
  const view = render(<LoginForm />);
  expect(screen.getByLabelText('Email')).toBeEnabled();
  expect(screen.getByLabelText('Password')).toBeEnabled();
  expect(screen.getByRole('button', { name: 'Sign In' })).toBeEnabled();
  expect(view.container.querySelector('form')).toHaveAttribute('data-client-ready', 'true');
});

it('exposes submit readiness only after the client form has mounted', () => {
  render(<LoginForm />);
  expect(screen.getByRole('button', { name: 'Sign In' }).closest('form')).toHaveAttribute('data-client-ready', 'true');
});
