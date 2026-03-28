import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Layout } from '../components/layout/Layout';
import { LoginPage } from '../pages/auth/LoginPage';
import { WorkflowsPage } from '../pages/workflows/WorkflowsPage';
import { WorkflowDetailPage } from '../pages/workflows/WorkflowDetailPage';
import { CreateWorkflowPage } from '../pages/workflows/CreateWorkflowPage';
import { ExecutionsPage } from '../pages/executions/ExecutionsPage';
import { ExecutionDetailPage } from '../pages/executions/ExecutionDetailPage';
import { MetricsPage } from '../pages/metrics/MetricsPage';
import { GraphExplorerPage } from '../pages/graph/GraphExplorerPage';
import { ApiKeysPage } from '../pages/apikeys/ApiKeysPage';
import { SettingsPage } from '../pages/settings/SettingsPage';
import { NotificationsPage } from '../pages/notifications/NotificationsPage';
import { NotFoundPage } from '../pages/NotFoundPage';

function ProtectedRoute({ children, adminOnly = false }: { children: React.ReactNode; adminOnly?: boolean }) {
  const { user, isAdmin, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-500" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (adminOnly && !isAdmin) {
    return <Navigate to="/workflows" replace />;
  }

  return <>{children}</>;
}

export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />

        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/workflows" replace />} />
          <Route path="workflows" element={<WorkflowsPage />} />
          <Route path="workflows/new" element={<CreateWorkflowPage />} />
          <Route path="workflows/:id" element={<WorkflowDetailPage />} />
          <Route path="executions" element={<ExecutionsPage />} />
          <Route path="executions/:id" element={<ExecutionDetailPage />} />
          <Route path="metrics" element={<MetricsPage />} />
          <Route path="graph" element={<GraphExplorerPage />} />
          <Route path="api-keys" element={<ProtectedRoute adminOnly><ApiKeysPage /></ProtectedRoute>} />
          <Route path="settings" element={<ProtectedRoute adminOnly><SettingsPage /></ProtectedRoute>} />
          <Route path="notifications" element={<NotificationsPage />} />
        </Route>

        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  );
}
