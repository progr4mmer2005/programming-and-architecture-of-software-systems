import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect } from 'react';
import Layout from '@/shared/components/Layout';
import { ProtectedRoute } from '@/shared/components/ProtectedRoute';
import { useAuthStore } from '@/stores/authStore';
import LoginPage from '@/pages/LoginPage';
import DashboardPage from '@/pages/DashboardPage';
import ContractsPage from '@/pages/ContractsPage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30000,
      retry: 1,
    },
  },
});

function PlaceholderPage({ title }: { title: string }) {
  return (
    <div className="flex items-center justify-center h-64">
      <p className="text-gray-400 text-lg">{title}</p>
    </div>
  );
}

function AppRoutes() {
  const { fetchUser, isAuthenticated } = useAuthStore();

  useEffect(() => {
    if (isAuthenticated) {
      fetchUser();
    }
  }, [isAuthenticated, fetchUser]);

  return (
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
        <Route index element={<DashboardPage />} />
        <Route path="contracts" element={<ContractsPage />} />
        <Route path="contracts/new" element={<PlaceholderPage title="Новый договор" />} />
        <Route path="contracts/:id" element={<PlaceholderPage title="Детали договора" />} />
        <Route path="contractors" element={<PlaceholderPage title="Контрагенты" />} />
        <Route path="templates" element={<PlaceholderPage title="Шаблоны договоров" />} />
        <Route path="estimates" element={<PlaceholderPage title="Сметы" />} />
        <Route path="approvals" element={<PlaceholderPage title="Согласование" />} />
        <Route path="payments" element={<PlaceholderPage title="Платежи" />} />
        <Route path="organization" element={<PlaceholderPage title="Управление организацией" />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </QueryClientProvider>
  );
}