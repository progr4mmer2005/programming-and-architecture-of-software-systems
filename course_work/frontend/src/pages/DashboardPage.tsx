import { useQuery } from '@tanstack/react-query';
import apiClient from '@/api/client';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';
import { FileText, DollarSign, Users, AlertCircle } from 'lucide-react';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

export default function DashboardPage() {
  const { data: summary } = useQuery({
    queryKey: ['dashboard', 'summary'],
    queryFn: () => apiClient.get('/dashboard/summary/').then((r) => r.data),
  });

  const { data: statusData } = useQuery({
    queryKey: ['dashboard', 'contracts-by-status'],
    queryFn: () => apiClient.get('/dashboard/contracts-by-status/').then((r) => r.data),
  });

  const { data: paymentsChart } = useQuery({
    queryKey: ['dashboard', 'payments-chart'],
    queryFn: () => apiClient.get('/dashboard/payments-chart/').then((r) => r.data),
  });

  const { data: upcomingPayments } = useQuery({
    queryKey: ['dashboard', 'upcoming-payments'],
    queryFn: () => apiClient.get('/dashboard/upcoming-payments/').then((r) => r.data),
  });

  const cards = [
    { label: 'Всего договоров', value: summary?.total_contracts ?? 0, icon: FileText, color: 'blue' },
    { label: 'Активных', value: summary?.active_contracts ?? 0, icon: FileText, color: 'green' },
    { label: 'Общая сумма', value: `${((summary?.total_amount ?? 0) / 1000000).toFixed(1)}M ₽`, icon: DollarSign, color: 'yellow' },
    { label: 'Контрагентов', value: summary?.total_contractors ?? 0, icon: Users, color: 'purple' },
    { label: 'На согласовании', value: summary?.approval_pending ?? 0, icon: AlertCircle, color: 'orange' },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Дашборд</h1>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {cards.map((card) => (
          <div key={card.label} className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg bg-${card.color}-100`}>
                <card.icon className={`h-5 w-5 text-${card.color}-600`} />
              </div>
              <div>
                <p className="text-xs text-gray-500">{card.label}</p>
                <p className="text-lg font-bold text-gray-900">{card.value}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Contracts by Status */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Договоры по статусам</h2>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={statusData || []}
                dataKey="value"
                nameKey="status"
                cx="50%"
                cy="50%"
                outerRadius={100}
                label
              >
                {(statusData || []).map((_: unknown, index: number) => (
                  <Cell key={index} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Legend />
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Payment Chart */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Платежи план/факт</h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={paymentsChart || []}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="planned" fill="#3b82f6" name="План" />
              <Bar dataKey="actual" fill="#10b981" name="Факт" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Upcoming Payments */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Предстоящие платежи</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-2 px-3 font-medium text-gray-500">Договор</th>
                <th className="text-left py-2 px-3 font-medium text-gray-500">Сумма</th>
                <th className="text-left py-2 px-3 font-medium text-gray-500">Дата</th>
              </tr>
            </thead>
            <tbody>
              {(upcomingPayments || []).length === 0 ? (
                <tr>
                  <td colSpan={3} className="text-center py-4 text-gray-400">
                    Нет предстоящих платежей
                  </td>
                </tr>
              ) : (
                (upcomingPayments || []).map((payment: any) => (
                  <tr key={payment.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-2 px-3">{payment.contract}</td>
                    <td className="py-2 px-3">{payment.amount.toLocaleString()} ₽</td>
                    <td className="py-2 px-3">{payment.planned_date}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}