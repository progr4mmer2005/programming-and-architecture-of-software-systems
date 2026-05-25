import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  BarChart3,
  Building2,
  CalendarDays,
  ChevronRight,
  FileSpreadsheet,
  FileText,
  LayoutDashboard,
  LogOut,
  Menu,
  Receipt,
  ShieldCheck,
  Sparkles,
  Users,
  WalletCards,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { Badge, Button } from '@/shared/components/ui';
import { hasPermission } from '@/shared/lib/access';
import { roleLabels } from '@/shared/types/domain';
import { cn } from '@/shared/lib/utils';

const navigation = [
  {
    name: 'Мои организации',
    href: '/workspace',
    permission: '',
    icon: Sparkles,
    description: 'Список ваших организаций, приглашения и быстрый переход в нужное рабочее пространство.',
  },
  {
    name: 'Главная',
    href: '/',
    permission: 'can_view_dashboard',
    icon: LayoutDashboard,
    description: 'Сводка по системе: что требует внимания прямо сейчас и с чего удобно начать работу.',
  },
  {
    name: 'Договоры',
    href: '/contracts',
    permission: 'can_view_contracts',
    icon: FileText,
    description: 'Основные карточки договоров: реквизиты, сроки, суммы, вложения, этапы и история изменений.',
  },
  {
    name: 'Контрагенты',
    href: '/contractors',
    permission: 'can_view_contractors',
    icon: Building2,
    description: 'Организации и партнёры, с которыми Вы работаете. Здесь хранятся реквизиты, контакты и связи.',
  },
  {
    name: 'Шаблоны',
    href: '/templates',
    permission: 'can_view_templates',
    icon: FileSpreadsheet,
    description: 'Заготовки типовых договоров, чтобы новые документы не приходилось собирать с нуля.',
  },
  {
    name: 'Сметы',
    href: '/estimates',
    permission: 'can_view_estimates',
    icon: Receipt,
    description: 'Расчёты стоимости по договорам: суммы, версии сметных файлов и история уточнений.',
  },
  {
    name: 'Согласование',
    href: '/approvals',
    permission: 'can_view_approvals',
    icon: ShieldCheck,
    description: 'Маршруты утверждения и текущие задачи: кто должен проверить документ и на каком он шаге.',
  },
  {
    name: 'Платежи',
    href: '/payments',
    permission: 'can_view_payments',
    icon: WalletCards,
    description: 'Плановые и фактические оплаты по договорам, а также контроль статусов и сроков платежей.',
  },
  {
    name: 'Календарь',
    href: '/calendar',
    permission: 'can_view_calendar',
    icon: CalendarDays,
    description: 'Общий календарь по срокам договоров, платежам, этапам исполнения и задачам согласования.',
  },
  {
    name: 'Отчёты',
    href: '/reports',
    permission: 'can_view_reports',
    icon: BarChart3,
    description: 'Сводные отчёты по исполнению договоров, плану и факту оплат, срокам и отклонениям.',
  },
  {
    name: 'Организация',
    href: '/organization',
    permission: 'can_view_organization',
    icon: Users,
    description: 'Профиль компании, сотрудники, роли доступа и справочники, которые используются во всей системе.',
  },
];

export default function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, permissions, invitations, logout } = useAuthStore();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const visibleNavigation = useMemo(
    () => navigation.filter((item) => item.permission ? hasPermission(permissions, item.permission) : true),
    [permissions],
  );

  const currentSection = useMemo(
    () =>
      visibleNavigation.find((item) => item.href !== '/'
        ? location.pathname.startsWith(item.href)
        : location.pathname === '/') ?? visibleNavigation[0] ?? navigation[0],
    [location.pathname, visibleNavigation],
  );

  const userInitials = `${user?.first_name?.[0] ?? ''}${user?.last_name?.[0] ?? ''}`.trim()
    || user?.username?.slice(0, 2).toUpperCase()
    || 'CW';

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="relative min-h-screen">
      {sidebarOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-30 bg-[rgba(19,14,10,0.32)] lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      ) : null}

      <div className="mx-auto flex min-h-screen max-w-[1680px] gap-4 px-3 py-3 sm:px-4 lg:gap-6 lg:px-6 lg:py-6">
        <aside
          className={cn(
            'fixed inset-y-3 left-3 z-40 w-[300px] rounded-[2rem] border border-[var(--line)] bg-[rgba(255,250,244,0.88)] p-4 shadow-[var(--shadow)] backdrop-blur-2xl transition duration-300 lg:sticky lg:top-6 lg:self-start lg:inset-auto lg:flex lg:translate-x-0 lg:flex-col',
            sidebarOpen ? 'translate-x-0' : '-translate-x-[120%] lg:translate-x-0',
          )}
        >
          <div className="flex items-center justify-between gap-3 rounded-[1.6rem] border border-[rgba(31,77,61,0.14)] bg-[rgba(31,77,61,0.08)] px-4 py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--brand)] text-white shadow-[0_18px_40px_rgba(31,77,61,0.22)]">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.24em] text-[var(--accent)]">
                  Course Work
                </p>
                <h1 className="section-heading text-2xl text-[var(--foreground)]">Договоры и документы</h1>
              </div>
            </div>
            <button
              type="button"
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[var(--line)] bg-white/70 text-[var(--muted-foreground)] lg:hidden"
              onClick={() => setSidebarOpen(false)}
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>

          <nav className="mt-5 space-y-2 pr-1">
            {visibleNavigation.map((item) => {
              const isActive = item.href === '/'
                ? location.pathname === item.href
                : location.pathname.startsWith(item.href);

              return (
                <Link
                  key={item.href}
                  to={item.href}
                  onClick={() => setSidebarOpen(false)}
                  className={cn(
                    'group flex items-start gap-3 rounded-[1.4rem] border px-4 py-3 transition',
                    isActive
                      ? 'border-[rgba(31,77,61,0.18)] bg-[rgba(31,77,61,0.09)]'
                      : 'border-transparent bg-white/45 hover:border-[var(--line)] hover:bg-white/75',
                  )}
                >
                  <div className={cn(
                    'mt-0.5 rounded-2xl border p-2.5 transition',
                    isActive
                      ? 'border-[rgba(31,77,61,0.15)] bg-white text-[var(--brand)]'
                      : 'border-[var(--line)] bg-white/80 text-[var(--muted-foreground)] group-hover:text-[var(--foreground)]',
                  )}
                  >
                    <item.icon className="h-5 w-5" />
                  </div>
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="text-sm font-semibold text-[var(--foreground)]">{item.name}</span>
                    {isActive ? <Badge tone="brand">Открыто</Badge> : null}
                  </div>
                </Link>
              );
            })}
          </nav>

          <div className="mt-5 rounded-[1.6rem] border border-[var(--line)] bg-white/80 p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--brand-soft)] text-sm font-bold text-[var(--brand)]">
                {userInitials}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-[var(--foreground)]">
                  {user?.full_name || user?.username}
                </p>
                <p className="truncate text-xs text-[var(--muted-foreground)]">
                  {user?.role ? roleLabels[user.role] || user.role : 'Пользователь'}
                </p>
                {invitations.length ? <Badge tone="accent" className="mt-2">{`Приглашений: ${invitations.length}`}</Badge> : null}
              </div>
            </div>
            <Button
              variant="ghost"
              className="mt-4 w-full justify-between rounded-2xl border border-[var(--line)] bg-white/60 px-4 text-[var(--foreground)] hover:bg-white"
              onClick={handleLogout}
            >
              Выйти
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col gap-4">
          <header className="glass-panel sticky top-3 z-20 flex flex-col gap-4 rounded-[2rem] border border-[var(--line)] px-4 py-4 shadow-[var(--shadow)] sm:px-5 lg:flex-row lg:items-center lg:justify-between lg:px-6">
            <div className="flex items-center gap-3">
              <button
                type="button"
                className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-[var(--line)] bg-white/80 text-[var(--foreground)] lg:hidden"
                onClick={() => setSidebarOpen(true)}
              >
                <Menu className="h-5 w-5" />
              </button>
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.22em] text-[var(--accent)]">
                  {currentSection.name}
                </p>
                <div className="mt-1 flex items-center gap-2">
                  <h2 className="text-lg font-semibold text-[var(--foreground)]">
                    {currentSection.description}
                  </h2>
                </div>
              </div>
            </div>
          </header>

          <main className="min-w-0 flex-1 pb-6">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}
