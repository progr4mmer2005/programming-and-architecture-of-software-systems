import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BarChart3, Download, FileSpreadsheet, FolderKanban } from 'lucide-react';
import apiClient from '@/api/client';
import { downloadCsv, formatDate, formatMoney, formatNumber } from '@/shared/lib/format';
import type { ExecutionReportItem } from '@/shared/types/domain';
import { Button, DataTable, EmptyState, Field, PageIntro, SectionCard, Select, StatCard } from '@/shared/components/ui';

export default function ReportsPage() {
  const [statusFilter, setStatusFilter] = useState('');

  const { data: report = [] } = useQuery<ExecutionReportItem[]>({
    queryKey: ['reports', 'execution'],
    queryFn: () => apiClient.get('/dashboard/execution_report/').then((response) => response.data),
  });

  const filtered = useMemo(
    () => report.filter((item) => !statusFilter || item.status === statusFilter),
    [report, statusFilter],
  );

  const totalAmount = filtered.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const totalDebt = filtered.reduce((sum, item) => sum + Number(item.debt || 0), 0);
  const activeCount = filtered.filter((item) => item.status === 'Действует' || item.status === 'Исполнение').length;

  const exportRegistry = () => {
    downloadCsv(
      'execution-report.csv',
      ['Номер', 'Договор', 'Контрагент', 'Статус', 'Сумма', 'План', 'Факт', 'Отклонение', 'Этапы', 'Следующий срок'],
      filtered.map((item) => [
        item.number,
        item.title,
        item.contractor,
        item.status,
        item.amount,
        item.planned_payments,
        item.actual_payments,
        item.debt,
        `${item.stages_completed}/${item.stages_total}`,
        item.next_deadline ? formatDate(item.next_deadline) : '',
      ]),
    );
  };

  const statusOptions = Array.from(new Set(report.map((item) => item.status))).filter(Boolean);

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="Отчёты и аналитика"
        title="Исполнение договоров"
        description="Раздел показывает реестр исполнения договоров, план/факт по платежам и ближайшие контрольные сроки. Данные доступны для экспорта в Excel-совместимом формате CSV."
        actions={(
          <Button onClick={exportRegistry} className="rounded-2xl px-5 py-3">
            <Download className="h-4 w-4" />
            Экспортировать реестр
          </Button>
        )}
      />

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard label="В отчёте" value={formatNumber(filtered.length)} hint={`${formatNumber(report.length)} договоров всего`} tone="brand" icon={<FolderKanban className="h-5 w-5" />} />
        <StatCard label="Активные и в исполнении" value={formatNumber(activeCount)} hint="Текущий рабочий портфель" tone="accent" icon={<BarChart3 className="h-5 w-5" />} />
        <StatCard label="Сумма / отклонение" value={formatMoney(totalAmount)} hint={`Отклонение ${formatMoney(totalDebt)}`} tone="neutral" icon={<FileSpreadsheet className="h-5 w-5" />} />
      </div>

      <SectionCard title="Параметры отчёта" description="При необходимости Вы можете сузить выборку по статусу договора, а затем выгрузить обновлённый реестр.">
        <div className="grid gap-4 md:grid-cols-[0.5fr_1.5fr]">
          <Field label="Статус">
            <Select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              <option value="">Все статусы</option>
              {statusOptions.map((status) => (
                <option key={status} value={status}>{status}</option>
              ))}
            </Select>
          </Field>
        </div>
      </SectionCard>

      <SectionCard title="Реестр исполнения" description="Отчёт объединяет карточку договора, платёжный календарь и прогресс этапов.">
        {filtered.length ? (
          <DataTable columns={['Номер', 'Договор', 'Контрагент', 'Статус', 'Сумма', 'План / факт', 'Этапы', 'Следующий срок']}>
            {filtered.map((item) => (
              <tr key={item.id} className="border-b border-[var(--line)] last:border-none">
                <td className="px-4 py-4 text-[var(--foreground)]">{item.number || '-'}</td>
                <td className="px-4 py-4">
                  <p className="font-semibold text-[var(--foreground)]">{item.title}</p>
                </td>
                <td className="px-4 py-4 text-[var(--muted-foreground)]">{item.contractor || 'Не указан'}</td>
                <td className="px-4 py-4 text-[var(--muted-foreground)]">{item.status}</td>
                <td className="px-4 py-4 text-[var(--muted-foreground)]">{formatMoney(item.amount)}</td>
                <td className="px-4 py-4 text-[var(--muted-foreground)]">
                  {formatMoney(item.planned_payments)} / {formatMoney(item.actual_payments)}
                </td>
                <td className="px-4 py-4 text-[var(--muted-foreground)]">{item.stages_completed}/{item.stages_total}</td>
                <td className="px-4 py-4 text-[var(--muted-foreground)]">{item.next_deadline ? formatDate(item.next_deadline) : 'Не указан'}</td>
              </tr>
            ))}
          </DataTable>
        ) : (
          <EmptyState title="Выборка пуста" description="По выбранным параметрам записи не найдены. Измените фильтр или сформируйте выборку повторно." />
        )}
      </SectionCard>
    </div>
  );
}


