import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { AuthProvider, useAuth } from '../context/AuthContext';
import * as authApi from '../api/auth';
import * as clientModule from '../api/client';
import type { User } from '../types';

const TEST_USER: User = {
  id: 'u1',
  email: 'test@chronos.dev',
  orgId: 'org-1',
  role: 'admin',
  createdAt: '2026-01-01T00:00:00.000Z',
};

function TestConsumer() {
  const { user, isAdmin, login, logout } = useAuth();
  return (
    <div>
      <span data-testid="email">{user?.email ?? 'none'}</span>
      <span data-testid="admin">{String(isAdmin)}</span>
      <button onClick={() => login('test@chronos.dev', 'pass')}>Login</button>
      <button onClick={logout}>Logout</button>
    </div>
  );
}

beforeEach(() => {
  vi.restoreAllMocks();
  vi.spyOn(clientModule, 'getStoredSession').mockReturnValue(null);
  vi.spyOn(clientModule, 'storeSession').mockImplementation(() => {});
  vi.spyOn(clientModule, 'clearSession').mockImplementation(() => {});
});

describe('AuthContext', () => {
  it('starts with no user when there is no stored session', async () => {
    render(<AuthProvider><TestConsumer /></AuthProvider>);
    await waitFor(() => {
      expect(screen.getByTestId('email').textContent).toBe('none');
    });
  });

  it('sets user on login', async () => {
    vi.spyOn(authApi, 'login').mockResolvedValue({
      token: 'tok',
      expiresAt: '2030-01-01T00:00:00.000Z',
      user: TEST_USER,
    });

    render(<AuthProvider><TestConsumer /></AuthProvider>);
    await act(async () => {
      await userEvent.click(screen.getByText('Login'));
    });

    expect(screen.getByTestId('email').textContent).toBe('test@chronos.dev');
    expect(screen.getByTestId('admin').textContent).toBe('true');
    expect(clientModule.storeSession).toHaveBeenCalledWith(
      expect.objectContaining({ token: 'tok' }),
    );
  });

  it('clears user on logout', async () => {
    vi.spyOn(authApi, 'login').mockResolvedValue({
      token: 'tok',
      expiresAt: '2030-01-01T00:00:00.000Z',
      user: TEST_USER,
    });

    render(<AuthProvider><TestConsumer /></AuthProvider>);
    await act(async () => {
      await userEvent.click(screen.getByText('Login'));
    });
    await act(async () => {
      await userEvent.click(screen.getByText('Logout'));
    });

    expect(screen.getByTestId('email').textContent).toBe('none');
    expect(clientModule.clearSession).toHaveBeenCalled();
  });

  it('restores session from localStorage if token is valid', async () => {
    vi.spyOn(clientModule, 'getStoredSession').mockReturnValue({
      token: 'stored-tok',
      expiresAt: '2030-01-01T00:00:00.000Z',
    });
    vi.spyOn(authApi, 'me').mockResolvedValue(TEST_USER);

    render(<AuthProvider><TestConsumer /></AuthProvider>);
    await waitFor(() => {
      expect(screen.getByTestId('email').textContent).toBe('test@chronos.dev');
    });
  });

  it('clears session if stored token is expired', async () => {
    vi.spyOn(clientModule, 'getStoredSession').mockReturnValue({
      token: 'bad-tok',
      expiresAt: '2020-01-01T00:00:00.000Z',
    });
    vi.spyOn(authApi, 'me').mockRejectedValue(new Error('Unauthorized'));

    render(<AuthProvider><TestConsumer /></AuthProvider>);
    await waitFor(() => {
      expect(screen.getByTestId('email').textContent).toBe('none');
      expect(clientModule.clearSession).toHaveBeenCalled();
    });
  });
});
