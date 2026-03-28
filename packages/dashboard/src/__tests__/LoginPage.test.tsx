import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { LoginPage } from '../pages/auth/LoginPage';
import { AuthProvider, useAuth } from '../context/AuthContext';
import * as clientModule from '../api/client';
import * as authApi from '../api/auth';
import type { User } from '../types';

const TEST_USER: User = {
  id: 'u1',
  email: 'admin@chronos.dev',
  orgId: 'org-1',
  role: 'admin',
  createdAt: '2026-01-01T00:00:00.000Z',
};

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => vi.fn() };
});

beforeEach(() => {
  vi.restoreAllMocks();
  vi.spyOn(clientModule, 'getStoredSession').mockReturnValue(null);
  vi.spyOn(clientModule, 'storeSession').mockImplementation(() => {});
  vi.spyOn(clientModule, 'clearSession').mockImplementation(() => {});
});

function Wrapper({ children }: { children: React.ReactNode }) {
  return (
    <MemoryRouter>
      <AuthProvider>{children}</AuthProvider>
    </MemoryRouter>
  );
}

describe('LoginPage', () => {
  it('renders email and password fields', () => {
    render(<LoginPage />, { wrapper: Wrapper });
    expect(screen.getByPlaceholderText(/admin@chronos.dev/i)).toBeTruthy();
    expect(screen.getByPlaceholderText(/••••••••/)).toBeTruthy();
  });

  it('shows error on failed login', async () => {
    vi.spyOn(authApi, 'login').mockRejectedValue(new Error('Invalid credentials'));
    render(<LoginPage />, { wrapper: Wrapper });

    await userEvent.type(screen.getByPlaceholderText(/admin@chronos.dev/i), 'wrong@test.com');
    await userEvent.type(screen.getByPlaceholderText(/••••••••/), 'wrongpass');
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(screen.getByText(/invalid email or password/i)).toBeTruthy();
    });
  });

  it('calls login with email and password on submit', async () => {
    const loginSpy = vi.spyOn(authApi, 'login').mockResolvedValue({
      token: 'tok',
      expiresAt: '2030-01-01T00:00:00.000Z',
      user: TEST_USER,
    });
    render(<LoginPage />, { wrapper: Wrapper });

    await userEvent.type(screen.getByPlaceholderText(/admin@chronos.dev/i), 'admin@chronos.dev');
    await userEvent.type(screen.getByPlaceholderText(/••••••••/), 'changeme123');
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(loginSpy).toHaveBeenCalledWith('admin@chronos.dev', 'changeme123');
    });
  });
});
