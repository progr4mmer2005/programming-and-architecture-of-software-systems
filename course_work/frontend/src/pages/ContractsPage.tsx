import { useQuery } from '@tanstack/react-query';
import apiClient from '@/api/client';
import { Link } from 'react-router-dom';

export default function ContractsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['contracts'],
    queryFn: () => apiClient.get('/contracts/').then((r) => r.data),
  });

  const statusLabels: Record<string, string> = {
    draft: 'Проект',
    approval: 'На согласовании',
    active: 'Действует',
    execution: 'Исполнение',
    closed: 'Закрыт',
    archived: 'Архив',
  };

  const statusColors: Record<string, string> = {
    draft: 'bg-gray-100 text-gray-800',
    approval: 'bg-yellow-100 text-yellow-800',
    active: 'bg-green-100 text-green-800',
    execution: 'bg-blue-100 text-blue-800',
    closed: 'bg-purple-100 text-purple-800',
    archived: 'bg-red-100 text-red-800',
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Договоры</h1>
        <Link
          to="/contracts/new"
          className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm hover:bg-blue-700"
        >
          + Новый договор
        </Link>
      </div>

      {isLoading ? (
        <div className="text-center py-8 text-gray-400">Загрузка...</div>
      ) : (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left py-3 px-4 font-medium text-gray-500">Номер</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-500">Название</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-500">Статус</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-500">Контрагент</th>
                  <th className="text-right py-3 px-4 font-medium text-gray-500">Сумма</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-500">Дата создания</th>
                </tr>
              </thead>
              <tbody>
                {(data?.results || []).length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-8 text-gray-400">
                      Нет договоров
                    </td>
                  </tr>
                ) : (
                  (data?.results || []).map((contract: any) => (
                    <tr key={contract.id} className="border-t border-gray-100 hover:bg-gray-50">
                      <td className="py-3 px-4 font-medium">{contract.number || '—'}</td>
                      <td className="py-3 px-4">
                        <Link to={`/contracts/${contract.id}`} className="text-blue-600 hover:underline">
                          {contract.title}
                        </Link>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[contract.status] || 'bg-gray-100'}`}>
                          {statusLabels[contract.status] || contract.status}
                        </span>
                      </td>
                      <td className="py-3 px-4">{contract.contractor_name || '—'}</td>
                      <td className="py-3 px-4 text-right">{Number(contract.amount).toLocaleString()} ₽</td>
                      <td className="py-3 px-4 text-gray-500">{contract.created_at?.split(' ')[0]}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}