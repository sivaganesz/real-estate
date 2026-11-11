import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router/dom';
import { AuthProvider } from '@/auth/AuthProvider';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { ApiError } from '@/lib/api';
import { router } from '@/router';
import { ThemeProvider } from '@/theme/ThemeProvider';
import './index.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Don't retry client errors (validation, permission, not found).
      retry: (count, error) => !(error instanceof ApiError && error.status < 500) && count < 2,
      refetchOnWindowFocus: false,
    },
  },
});

const root = document.getElementById('root');
if (!root) throw new Error('Root element #root not found');

createRoot(root).render(
  <StrictMode>
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider delay={300}>
          <AuthProvider>
            <RouterProvider router={router} />
          </AuthProvider>
        </TooltipProvider>
        <Toaster position="top-right" richColors />
      </QueryClientProvider>
    </ThemeProvider>
  </StrictMode>,
);
