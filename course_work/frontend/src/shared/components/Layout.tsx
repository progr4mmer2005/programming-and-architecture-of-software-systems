import { Link, useLocation, Outlet, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import {
  LayoutDashboard,
  FileText,
  Users,
  Building2,
  Receipt,
  CheckSquare,
  DollarSign,
  FileSpreadsheet,
  LogOut,
  ChevronRight,
} from 'lucide-react';
import { useState } from 'react';

const navigation = [
  { name: 'Дашборд', href: '/', icon: LayoutDashboard },
  { name: 'Договоры', href: '/contracts', icon: FileText },
  { name: 'Контрагенты', href: '/contractors', icon: Building2 },
  { name: 'Шаблоны', href: '/templates', icon: FileSpreadsheet },
  { name: 'Сметы', href: '/estimates', icon: Receipt },
  { name: 'Согласование', href: '/approvals', icon: CheckSquare },
  { name: 'Платежи', href: '/payments', icon: DollarSign },
  { name: 'Организация', href: '/organization', icon: Users },
];

export default function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const roleLabels: Record<string, string> = {
    owner: 'Владелец',
    director: 'Руководитель',
    manager: 'Менеджер',
    lawyer: 'Юрист',
    finance: 'Финансист',
    admin: 'Администратор',
  };

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <aside
        className={`${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } fixed inset-y-0 left-0 z-30 w-64 bg-white border-r border-gray-200 lg:translate-x-0 lg:static lg:inset-auto transition-transform duration-200 ease-in-out`}
      >
        <div className="flex items-center justify-between h-16 px-4 border-b border-gray-200">
          <h1 className="text-lg font-bold text-gray-900">АИС Договоры</h1>
        </div>
        <nav className="mt-4 px-2 space-y-1">
          {navigation.map((item) => {
            const isActive = location.pathname === item.href;
            return (
              <Link
                key={item.name}
                to={item.href}
                className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <item.icon className="h-5 w-5 flex-shrink-0" />
                {item.name}
              </Link>
            );
          })}
        </nav>
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-200">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
              <span className="text-sm font-medium text-blue-700">
                {user?.first_name?.[0] || user?.username?.[0] || '?'}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">
                {user?.full_name || user?.username}
              </p>
              <p className="text-xs text-gray-500">
                {user?.role ? roleLabels[user.role] || user.role : ''}
              </p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-md transition-colors"
          >
            <LogOut className="h-4 w-4" />
            Выйти
          </button>
        </div>
      </aside>

      {/* Overlay for mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-20 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 bg-white border-b border-gray-200 flex items-center px-4 lg:px-6">
          <button
            className="lg:hidden mr-4 text-gray-500 hover:text-gray-700"
            onClick={() => setSidebarOpen(true)}
          >
            <ChevronRight className="h-6 w-6" />
          </button>
          <h2 className="text-lg font-semibold text-gray-900">
            {navigation.find((n) => n.href === location.pathname)?.name || 'АИС Управление договорами'}
          </h2>
        </header>
        <main className="flex-1 p-4 lg:p-6 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}