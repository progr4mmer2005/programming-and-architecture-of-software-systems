import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect } from 'react';
import Layout from '@/shared/components/Layout';
import { ProtectedRoute } from '@/shared/components/ProtectedRoute';
import { RoleRoute } from '@/shared/components/RoleRoute';
import { useAuthStore } from '@/stores/authStore';
import LoginPage from '@/pages/LoginPage';
import DashboardPage from '@/pages/DashboardPage';
import ContractsPage from '@/pages/ContractsPage';
import ContractEditorPage from '@/pages/ContractEditorPage';
import ContractDetailsPage from '@/pages/ContractDetailsPage';
import ContractorsPage from '@/pages/ContractorsPage';
import TemplatesPage from '@/pages/TemplatesPage';
import EstimatesPage from '@/pages/EstimatesPage';
import EstimateDetailsPage from '@/pages/EstimateDetailsPage';
import ApprovalsPage from '@/pages/ApprovalsPage';
import PaymentsPage from '@/pages/PaymentsPage';
import OrganizationPage from '@/pages/OrganizationPage';
import ReportsPage from '@/pages/ReportsPage';
import CalendarPage from '@/pages/CalendarPage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function AppRoutes() {
  const { fetchUser, isAuthenticated } = useAuthStore();

  useEffect(() => {
    if (isAuthenticated) {
      fetchUser();
    }
  }, [fetchUser, isAuthenticated]);

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/"
        element={(
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        )}
      >
        <Route index element={<RoleRoute permission="can_view_dashboard"><DashboardPage /></RoleRoute>} />
        <Route path="contracts" element={<RoleRoute permission="can_view_contracts"><ContractsPage /></RoleRoute>} />
        <Route path="contracts/new" element={<RoleRoute permission="can_manage_contracts"><ContractEditorPage /></RoleRoute>} />
        <Route path="contracts/:id" element={<RoleRoute permission="can_view_contracts"><ContractDetailsPage /></RoleRoute>} />
        <Route path="contractors" element={<RoleRoute permission="can_view_contractors"><ContractorsPage /></RoleRoute>} />
        <Route path="templates" element={<RoleRoute permission="can_view_templates"><TemplatesPage /></RoleRoute>} />
        <Route path="estimates" element={<RoleRoute permission="can_view_estimates"><EstimatesPage /></RoleRoute>} />
        <Route path="estimates/:id" element={<RoleRoute permission="can_view_estimates"><EstimateDetailsPage /></RoleRoute>} />
        <Route path="approvals" element={<RoleRoute permission="can_view_approvals"><ApprovalsPage /></RoleRoute>} />
        <Route path="payments" element={<RoleRoute permission="can_view_payments"><PaymentsPage /></RoleRoute>} />
        <Route path="calendar" element={<RoleRoute permission="can_view_calendar"><CalendarPage /></RoleRoute>} />
        <Route path="reports" element={<RoleRoute permission="can_view_reports"><ReportsPage /></RoleRoute>} />
        <Route path="organization" element={<RoleRoute permission="can_view_organization"><OrganizationPage /></RoleRoute>} />
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
