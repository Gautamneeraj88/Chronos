import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { AuthProvider } from './context/AuthContext';
import { NotificationProvider } from './context/NotificationContext';
import { ObservabilityProvider } from './context/ObservabilityContext';
import { AppRouter } from './router';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
    },
  },
});

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ObservabilityProvider>
        <NotificationProvider>
          <AppRouter />
          <Toaster
            position="bottom-right"
            toastOptions={{
              classNames: {
                toast: 'font-sans text-sm shadow-modal',
              },
            }}
          />
        </NotificationProvider>
        </ObservabilityProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
