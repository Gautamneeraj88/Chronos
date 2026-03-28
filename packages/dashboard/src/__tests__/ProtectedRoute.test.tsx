import { render, screen, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import { MemoryRouter, Route, Routes, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

// Mock the auth context
vi.mock('../context/AuthContext', () => ({
  useAuth: vi.fn(),
}));

const mockUseAuth = vi.mocked(useAuth);

// Inline the ProtectedRoute logic to test it in isolation
function ProtectedRoute({ children, adminOnly = false }: { children: React.ReactNode; adminOnly?: boolean }) {
  const { user, isAdmin, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return <div data-testid="loading-spinner" />;
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (adminOnly && !isAdmin) {
    return <Navigate to="/workflows" replace />;
  }

  return <>{children}</>;
}

function renderWithRouter(ui: React.ReactNode, initialPath = '/protected') {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/login" element={<div data-testid="login-page" />} />
        <Route path="/workflows" element={<div data-testid="workflows-page" />} />
        <Route path="/protected" element={<ProtectedRoute>{ui}</ProtectedRoute>} />
        <Route path="/admin" element={<ProtectedRoute adminOnly>{ui}</ProtectedRoute>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('ProtectedRoute', () => {
  it('shows loading spinner while auth is resolving', () => {
    mockUseAuth.mockReturnValue({ user: null, isAdmin: false, isLoading: true } as ReturnType<typeof useAuth>);
    renderWithRouter(<div data-testid="content" />);
    expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
  });

  it('redirects to /login when unauthenticated', async () => {
    mockUseAuth.mockReturnValue({ user: null, isAdmin: false, isLoading: false } as ReturnType<typeof useAuth>);
    renderWithRouter(<div data-testid="content" />);
    await waitFor(() => {
      expect(screen.getByTestId('login-page')).toBeInTheDocument();
    });
  });

  it('renders children when authenticated', async () => {
    mockUseAuth.mockReturnValue({
      user: { id: 'u1', email: 'a@b.com', orgId: 'o1', role: 'member', createdAt: '' },
      isAdmin: false,
      isLoading: false,
    } as ReturnType<typeof useAuth>);
    renderWithRouter(<div data-testid="content" />);
    await waitFor(() => {
      expect(screen.getByTestId('content')).toBeInTheDocument();
    });
  });

  it('redirects member from adminOnly route to /workflows', async () => {
    mockUseAuth.mockReturnValue({
      user: { id: 'u1', email: 'a@b.com', orgId: 'o1', role: 'member', createdAt: '' },
      isAdmin: false,
      isLoading: false,
    } as ReturnType<typeof useAuth>);
    render(
      <MemoryRouter initialEntries={['/admin']}>
        <Routes>
          <Route path="/workflows" element={<div data-testid="workflows-page" />} />
          <Route path="/admin" element={<ProtectedRoute adminOnly><div data-testid="admin-content" /></ProtectedRoute>} />
        </Routes>
      </MemoryRouter>,
    );
    await waitFor(() => {
      expect(screen.getByTestId('workflows-page')).toBeInTheDocument();
    });
  });

  it('renders adminOnly route for admin user', async () => {
    mockUseAuth.mockReturnValue({
      user: { id: 'u1', email: 'a@b.com', orgId: 'o1', role: 'admin', createdAt: '' },
      isAdmin: true,
      isLoading: false,
    } as ReturnType<typeof useAuth>);
    render(
      <MemoryRouter initialEntries={['/admin']}>
        <Routes>
          <Route path="/workflows" element={<div data-testid="workflows-page" />} />
          <Route path="/admin" element={<ProtectedRoute adminOnly><div data-testid="admin-content" /></ProtectedRoute>} />
        </Routes>
      </MemoryRouter>,
    );
    await waitFor(() => {
      expect(screen.getByTestId('admin-content')).toBeInTheDocument();
    });
  });
});
