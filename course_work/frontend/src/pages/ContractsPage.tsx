import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { ArrowRight, CircleSlash, Plus, Search, ShieldCheck, Sparkles, Trash2 } from 'lucide-react';
import apiClient from '@/api/client';
import { useAuthStore } from '@/stores/authStore';
import { formatContractPrice, formatDate, formatMoney, formatNumber, getResults } from '@/shared/lib/format';
import type { Contract, PaginatedResponse } from '@/shared/types/domain';
import { contractStatusOptions } from '@/shared/types/domain';
import { Badge, Button, EmptyState, Field, Input, LoadingBlock, PageIntro, SectionCard, Select, StatCard } from '@/shared/components/ui';

const statusOptions = [{ value: '', label: 'Все статусы' }, ...contractStatusOptions];

function getContractTone(status: string) {
  if (status === 'active') {
    return 'success';
  }
  if (status === 'on_approval') {
    return 'accent';
  }
  if (status === 'completed' || status === 'terminated') {
    return 'neutral';
  }
  if (status === 'signed' || status === 'ready_to_sign') {
    return 'brand';
  }
  return 'neutral';
}

export default function ContractsPage() {
  const permissions = useAuthStore((state) => state.permissions);
  const canManageContracts = Boolean(permissions?.can_manage_contracts);
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');

  const deleteMutation = useMutation({
    mutationFn: (contractId: number) => apiClient.delete(`/contracts/${contractId}/`),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['contracts'] });
    },
  });

  const { data, isLoading } = useQuery<PaginatedResponse<Contract>>({
    queryKey: ['contracts', search, status],
    queryFn: async () => {
      const response = await apiClient.get('/contracts/', {
        params: {
          search: search || undefined,
          status: status || undefined,
        },
      });
      return response.data;
    },
  });

  const contracts = getResults(data);
  const totalAmount = contracts.reduce((sum, item) => sum + Number(item.amount ?? 0), 0);
  const activeCount = contracts.filter((item) => item.status === 'active').length;
  const approvalCount = contracts.filter((item) => item.status === 'on_approval').length;

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="Реестр договоров"
        title="Все договоры под рукой"
        description="Раздел позволяет отбирать договоры по этапам, анализировать суммы и переходить в детальную карточку."
        actions={canManageContracts ? (
          <Link to="/contracts/new">
            <Button className="rounded-2xl px-5 py-3">
              <Plus className="h-4 w-4" />
              Новый договор
            </Button>
          </Link>
        ) : undefined}
      />

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard
          label="В выборке"
          value={formatNumber(contracts.length)}
          hint={`${formatNumber(data?.count)} всего в базе`}
          tone="brand"
          icon={<Sparkles className="h-5 w-5" />}
        />
        <StatCard
          label="Активные"
          value={formatNumber(activeCount)}
          hint={`${formatNumber(approvalCount)} на согласовании`}
          tone="neutral"
          icon={<ShieldCheck className="h-5 w-5" />}
        />
        <StatCard
          label="Сумма"
          value={formatMoney(totalAmount)}
          hint="По текущему фильтру"
          tone="accent"
          icon={<CircleSlash className="h-5 w-5" />}
        />
      </div>

      <SectionCard title="Поиск и фильтры" description="Здесь можно сузить список перед анализом или переходом в конкретную карточку договора.">
        <div className="grid gap-4 md:grid-cols-[1.4fr_0.6fr]">
          <Field label="Поиск по номеру, названию или описанию">
            <div className="relative">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted-foreground)]" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Например: поставка оборудования"
                className="pl-11"
              />
            </div>
          </Field>
          <Field label="Статус">
            <Select value={status} onChange={(event) => setStatus(event.target.value)}>
              {statusOptions.map((option) => (
                <option key={option.value || 'all'} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      </SectionCard>

      <SectionCard title="Реестр договоров" description="Каждая карточка открывает полный профиль договора: реквизиты, сроки, версии, этапы, платежи и историю изменений.">
        {isLoading ? (
          <LoadingBlock label="Загружаем реестр договоров..." />
        ) : contracts.length ? (
          <div className="grid gap-4 xl:grid-cols-2">
            {contracts.map((contract) => (
              <Link
                key={contract.id}
                to={`/contracts/${contract.id}`}
                className="group rounded-[1.8rem] border border-[var(--line)] bg-white/75 p-5 transition hover:-translate-y-0.5 hover:border-[var(--line-strong)] hover:bg-white"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={getContractTone(contract.status)}>
                        {contract.status_display || contract.status}
                      </Badge>
                      <Badge tone="neutral">{contract.number || 'Без номера'}</Badge>
                    </div>
                    <h3 className="break-words text-lg font-semibold leading-8 text-[var(--foreground)]">{contract.title}</h3>
                    <p className="break-words text-sm text-[var(--muted-foreground)]">
                      {contract.contractor_name || 'Контрагент пока не выбран'}
                    </p>
                  </div>
                  <ArrowRight className="h-5 w-5 text-[var(--muted-foreground)] transition group-hover:translate-x-1 group-hover:text-[var(--foreground)]" />
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-2xl border border-[var(--line)] bg-[rgba(255,255,255,0.68)] px-4 py-3">
                    <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--muted-foreground)]">Сумма</p>
                    <p className="mt-2 break-words text-sm font-semibold leading-6 text-[var(--foreground)]">{formatContractPrice(contract)}</p>
                  </div>
                  <div className="rounded-2xl border border-[var(--line)] bg-[rgba(255,255,255,0.68)] px-4 py-3">
                    <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--muted-foreground)]">Период</p>
                    <p className="mt-2 text-sm font-semibold text-[var(--foreground)]">
                      {contract.start_date ? formatDate(contract.start_date) : 'Без даты'}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-[var(--line)] bg-[rgba(255,255,255,0.68)] px-4 py-3">
                    <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--muted-foreground)]">Версия</p>
                    <p className="mt-2 text-sm font-semibold text-[var(--foreground)]">v{contract.current_version}</p>
                  </div>
                </div>
                {canManageContracts ? (
                  <div className="mt-4 flex justify-end">
                    <Button
                      variant="ghost"
                      onClick={async (event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        if (!confirm(`Удалить договор "${contract.title}"?`)) {
                          return;
                        }
                        await deleteMutation.mutateAsync(contract.id);
                      }}
                      busy={deleteMutation.isPending}
                    >
                      <Trash2 className="h-4 w-4" />
                      Удалить
                    </Button>
                  </div>
                ) : null}
              </Link>
            ))}
          </div>
        ) : (
          <EmptyState
            title="Договоров по фильтру нет"
            description="По текущим параметрам договоры не найдены. Измените фильтр или создайте первую карточку договора."
            action={canManageContracts ? (
              <Link to="/contracts/new">
                <Button className="rounded-2xl px-5">Создать договор</Button>
              </Link>
            ) : undefined}
          />
        )}
      </SectionCard>
    </div>
  );
}



