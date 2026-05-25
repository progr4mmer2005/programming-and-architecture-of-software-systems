import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  AlertTriangle,
  BadgeRussianRuble,
  BellRing,
  FileText,
  LayoutList,
  ShieldCheck,
} from 'lucide-react';
import apiClient from '@/api/client';
import { formatContractPrice, formatDate, formatMoney, formatNumber, getResults } from '@/shared/lib/format';
import type {
  AuditLog,
  Contract,
  DashboardAlert,
  PaginatedResponse,
  PaymentCalendar,
} from '@/shared/types/domain';
import { Badge, DataTable, EmptyState, LoadingBlock, PageIntro, SectionCard, StatCard } from '@/shared/components/ui';

interface DashboardSummary {
  total_contracts: number;
  active_contracts: number;
  draft_contracts: number;
  approval_pending: number;
  total_contractors: number;
  total_amount: number;
  upcoming_payments_count: number;
}

interface StatusChartItem {
  status: string;
  value: number;
}

interface PaymentsChartItem {
  month: string;
  planned: number;
  actual: number;
}

interface UpcomingPayment {
  id: number;
  contract: string;
  amount: number;
  planned_date: string;
  status: string;
}

const COLORS = ['#1f4d3d', '#b38a52', '#7f6750', '#b44f40', '#6f9b89', '#d3bf99'];

function alertTone(level: string) {
  if (level === 'danger') {
    return 'danger';
  }
  if (level === 'accent') {
    return 'accent';
  }
  return 'neutral';
}

export default function DashboardPage() {
  const { data: summary, isLoading: summaryLoading } = useQuery<DashboardSummary>({
    queryKey: ['dashboard', 'summary'],
    queryFn: () => apiClient.get('/dashboard/summary/').then((response) => response.data),
  });

  const { data: statusData } = useQuery<StatusChartItem[]>({
    queryKey: ['dashboard', 'contracts-by-status'],
    queryFn: () => apiClient.get('/dashboard/contracts-by-status/').then((response) => response.data),
  });

  const { data: paymentsChart } = useQuery<PaymentsChartItem[]>({
    queryKey: ['dashboard', 'payments-chart'],
    queryFn: () => apiClient.get('/dashboard/payments-chart/').then((response) => response.data),
  });

  const { data: upcomingPayments } = useQuery<UpcomingPayment[]>({
    queryKey: ['dashboard', 'upcoming-payments'],
    queryFn: () => apiClient.get('/dashboard/upcoming-payments/').then((response) => response.data),
  });

  const { data: alerts } = useQuery<DashboardAlert[]>({
    queryKey: ['dashboard', 'alerts'],
    queryFn: () => apiClient.get('/dashboard/alerts/').then((response) => response.data),
  });

  const { data: contractsPayload } = useQuery<PaginatedResponse<Contract>>({
    queryKey: ['dashboard', 'latest-contracts'],
    queryFn: () => apiClient.get('/contracts/').then((response) => response.data),
  });

  const { data: auditPayload } = useQuery<PaginatedResponse<AuditLog>>({
    queryKey: ['dashboard', 'audit'],
    queryFn: () => apiClient.get('/audit-logs/').then((response) => response.data),
  });

  const { data: calendarPayload } = useQuery<PaymentCalendar[]>({
    queryKey: ['dashboard', 'payment-calendar'],
    queryFn: () => apiClient.get('/payment-calendar/').then((response) => response.data.results ?? response.data),
  });

  const recentContracts = getResults(contractsPayload).slice(0, 5);
  const recentAudit = getResults(auditPayload).slice(0, 6);
  const currentCalendar = (calendarPayload ?? [])[0];
  const hasPaymentsHistory = (paymentsChart ?? []).some(
    (item) => Number(item.planned) > 0 || Number(item.actual) > 0,
  );

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="Обзор системы"
        title="АИС управления договорами и сметами"
        description="На дашборде собраны ключевые показатели по договорам, оплатам, срокам и согласованию. Здесь же выводятся уведомления, требующие внимания."
      />

      {summaryLoading ? <LoadingBlock label="Подготавливаем сводные показатели..." /> : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <Link to="/contracts" className="block transition hover:-translate-y-0.5">
          <StatCard
            label="Всего договоров"
            value={formatNumber(summary?.total_contracts)}
            hint={`${formatNumber(summary?.draft_contracts)} в статусе проекта`}
            tone="brand"
            icon={<FileText className="h-5 w-5" />}
          />
        </Link>
        <Link to="/approvals" className="block transition hover:-translate-y-0.5">
          <StatCard
            label="Активные"
            value={formatNumber(summary?.active_contracts)}
            hint={`${formatNumber(summary?.approval_pending)} на согласовании`}
            tone="neutral"
            icon={<ShieldCheck className="h-5 w-5" />}
          />
        </Link>
        <Link to="/reports" className="block transition hover:-translate-y-0.5">
          <StatCard
            label="Общая сумма"
            value={formatMoney(summary?.total_amount)}
            hint="По всем договорам организации"
            tone="accent"
            icon={<BadgeRussianRuble className="h-5 w-5" />}
          />
        </Link>
        <Link to="/contractors" className="block transition hover:-translate-y-0.5">
          <StatCard
            label="Контрагенты"
            value={formatNumber(summary?.total_contractors)}
            hint="Партнёры и поставщики"
            tone="neutral"
            icon={<LayoutList className="h-5 w-5" />}
          />
        </Link>
        <Link to="/payments" className="block transition hover:-translate-y-0.5">
          <StatCard
            label="Ближайшие платежи"
            value={formatNumber(summary?.upcoming_payments_count)}
            hint={currentCalendar ? `Отклонение месяца ${formatMoney(currentCalendar.debt)}` : 'Календарь обновится после загрузки записей'}
            tone="danger"
            icon={<AlertTriangle className="h-5 w-5" />}
          />
        </Link>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <SectionCard
          title="Уведомления и контрольные сроки"
          description="Сроки, просрочки, задачи согласования и ближайшие события."
        >
          <div className="space-y-3">
            {(alerts ?? []).length ? (
              (alerts ?? []).map((alert) => {
                const content = (
                  <div className="rounded-[1.5rem] border border-[var(--line)] bg-white/75 p-4 transition hover:border-[var(--line-strong)] hover:bg-white">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <BellRing className="h-4 w-4 text-[var(--brand)]" />
                          <p className="break-words text-sm font-semibold text-[var(--foreground)]">{alert.title}</p>
                          <Badge tone={alertTone(alert.level)}>{alert.kind.replaceAll('_', ' ')}</Badge>
                        </div>
                        <p className="mt-2 break-words text-sm leading-7 text-[var(--muted-foreground)]">{alert.description}</p>
                        {alert.subtitle ? <p className="mt-1 break-words text-xs text-[var(--muted-foreground)]">{alert.subtitle}</p> : null}
                      </div>
                      <div className="max-w-full min-w-0 text-left text-sm text-[var(--muted-foreground)] md:text-right">
                        <p>{alert.date ? formatDate(alert.date) : 'Без даты'}</p>
                        {typeof alert.amount === 'number' ? <p className="mt-1 break-words font-semibold text-[var(--foreground)]">{formatMoney(alert.amount)}</p> : null}
                      </div>
                    </div>
                  </div>
                );

                if (alert.contract_id) {
                  return (
                    <Link key={`${alert.kind}-${alert.contract_id}-${alert.title}-${alert.date}`} to={`/contracts/${alert.contract_id}`} className="block">
                      {content}
                    </Link>
                  );
                }

                return (
                  <div key={`${alert.kind}-${alert.contract_id}-${alert.title}-${alert.date}`}>
                    {content}
                  </div>
                );
              })
            ) : (
              <EmptyState title="Критичных уведомлений нет" description="По текущим данным просрочки и ближайшие риски не выявлены." />
            )}
          </div>
        </SectionCard>

        <SectionCard
          title="Календарь платежей"
          description="План/факт по текущему периоду и динамика за последние месяцы."
        >
          {currentCalendar ? (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-[1.5rem] border border-[var(--line)] bg-white/75 p-4">
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--muted-foreground)]">План</p>
                  <p className="mt-2 text-2xl font-bold text-[var(--foreground)]">{formatMoney(currentCalendar.total_planned)}</p>
                </div>
                <div className="rounded-[1.5rem] border border-[var(--line)] bg-white/75 p-4">
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--muted-foreground)]">Факт</p>
                  <p className="mt-2 text-2xl font-bold text-[var(--foreground)]">{formatMoney(currentCalendar.total_actual)}</p>
                </div>
                <div className="rounded-[1.5rem] border border-[var(--line)] bg-white/75 p-4">
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--muted-foreground)]">Отклонение</p>
                  <p className="mt-2 text-2xl font-bold text-[var(--foreground)]">{formatMoney(currentCalendar.debt)}</p>
                </div>
              </div>

              {hasPaymentsHistory ? (
                <div className="h-[220px] rounded-[1.5rem] border border-[var(--line)] bg-white/70 p-3">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={paymentsChart ?? []}>
                      <CartesianGrid strokeDasharray="2 8" stroke="rgba(36,30,24,0.1)" vertical={false} />
                      <XAxis dataKey="month" tick={{ fill: '#6b6258', fontSize: 12 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: '#6b6258', fontSize: 12 }} axisLine={false} tickLine={false} />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="planned" fill="#b38a52" radius={[10, 10, 0, 0]} name="План" />
                      <Bar dataKey="actual" fill="#1f4d3d" radius={[10, 10, 0, 0]} name="Факт" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="rounded-[1.5rem] border border-dashed border-[var(--line-strong)] bg-white/55 px-5 py-8">
                  <p className="text-sm font-semibold text-[var(--foreground)]">
                    История для графика пока не накоплена
                  </p>
                  <p className="mt-2 text-sm leading-7 text-[var(--muted-foreground)]">
                    Когда в системе накопится больше плановых и фактических платежей, здесь появится наглядная динамика по месяцам.
                  </p>
                </div>
              )}
            </div>
          ) : (
            <EmptyState title="Календарь пока пуст" description="После регистрации плановых и фактических платежей здесь появится сводка план/факт." />
          )}
        </SectionCard>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.35fr_0.65fr]">
        <SectionCard
          title="Статусы договоров"
          description="Текущая структура портфеля по жизненному циклу."
        >
          {(statusData ?? []).length ? (
            <div className="grid gap-6 lg:grid-cols-2">
              <div className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={statusData ?? []} dataKey="value" nameKey="status" cx="50%" cy="50%" outerRadius={96} innerRadius={56}>
                      {(statusData ?? []).map((entry, index) => (
                        <Cell key={`${entry.status}-${entry.value}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-3">
                {(statusData ?? []).map((item, index) => (
                  <div key={item.status} className="flex items-center justify-between rounded-2xl border border-[var(--line)] bg-white/70 px-4 py-3">
                    <div className="flex items-center gap-3">
                      <span className="h-3 w-3 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                      <span className="text-sm font-semibold text-[var(--foreground)]">{item.status}</span>
                    </div>
                    <Badge tone="neutral">{formatNumber(item.value)}</Badge>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <EmptyState
              title="Статусы пока не рассчитаны"
              description="В этой организации ещё нет договоров или у договоров не задан статус. После создания/обновления договоров здесь появится распределение."
            />
          )}
        </SectionCard>

        <SectionCard title="Ближайшие платежи" description="Следующие плановые обязательства в горизонте 30 дней.">
          {(upcomingPayments ?? []).length ? (
            <DataTable columns={['Договор', 'Сумма', 'Дата']}>
              {(upcomingPayments ?? []).map((payment) => (
                <tr key={payment.id} className="border-b border-[var(--line)] last:border-none">
                  <td className="px-4 py-4 font-medium text-[var(--foreground)]">
                    <Link to="/payments" className="transition hover:text-[var(--brand)]">
                      {payment.contract}
                    </Link>
                  </td>
                  <td className="px-4 py-4 text-[var(--muted-foreground)]">{formatMoney(payment.amount)}</td>
                  <td className="px-4 py-4 text-[var(--muted-foreground)]">{formatDate(payment.planned_date)}</td>
                </tr>
              ))}
            </DataTable>
          ) : (
            <EmptyState title="Плановых выплат не найдено" description="После формирования платёжного календаря здесь появятся ближайшие обязательства." />
          )}
        </SectionCard>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <SectionCard title="Свежие договоры" description="Новые и недавно обновлённые карточки.">
          <div className="space-y-3">
            {recentContracts.length ? (
              recentContracts.map((contract) => (
                <Link key={contract.id} to={`/contracts/${contract.id}`} className="block rounded-[1.5rem] border border-[var(--line)] bg-white/75 px-4 py-4 transition hover:-translate-y-0.5 hover:border-[var(--line-strong)] hover:bg-white">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-[var(--foreground)]">{contract.title}</p>
                      <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                        {contract.number || 'Без номера'} • {contract.contractor_name || 'Контрагент не указан'}
                      </p>
                    </div>
                    <Badge tone={contract.status === 'active' ? 'success' : contract.status === 'on_approval' ? 'accent' : 'neutral'}>
                      {contract.status_display || contract.status}
                    </Badge>
                  </div>
                  <div className="mt-3 flex items-center justify-between text-xs text-[var(--muted-foreground)]">
                    <span>{formatContractPrice(contract)}</span>
                    <span>{formatDate(contract.created_at)}</span>
                  </div>
                </Link>
              ))
            ) : (
              <EmptyState title="Карточки договоров ещё не созданы" description="После регистрации первого договора здесь появятся последние изменения по реестру." />
            )}
          </div>
        </SectionCard>

        <SectionCard title="Журнал активности" description="Последние изменения по ключевым сущностям.">
          <div className="space-y-3">
            {recentAudit.length ? (
              recentAudit.map((item) => (
                <div key={item.id} className="flex flex-col gap-2 rounded-[1.5rem] border border-[var(--line)] bg-white/75 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-[var(--foreground)]">{item.description || `${item.entity_type} #${item.entity_id}`}</p>
                    <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                      {item.user_name || 'Система'} • {item.entity_type} #{item.entity_id}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge tone="neutral">{item.action}</Badge>
                    <span className="text-xs text-[var(--muted-foreground)]">{formatDate(item.created_at, true)}</span>
                  </div>
                </div>
              ))
            ) : (
              <EmptyState title="Журнал активности пока пуст" description="История будет наполняться автоматически по мере работы с договорами, сметами и оплатами." />
            )}
          </div>
        </SectionCard>
      </div>
    </div>
  );
}

