import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { FileSpreadsheet, Plus, Receipt } from 'lucide-react';
import apiClient from '@/api/client';
import { formatMoney, formatNumber, getResults } from '@/shared/lib/format';
import type { Contract, Estimate, EstimateStatus, PaginatedResponse } from '@/shared/types/domain';
import { estimateStatusOptions } from '@/shared/types/domain';
import { Badge, Button, EmptyState, Field, Input, Modal, PageIntro, SectionCard, Select, StatCard } from '@/shared/components/ui';
import { useAuthStore } from '@/stores/authStore';

interface EstimateFormState { contract: string; title: string; number: string; status: EstimateStatus; currency: string; }
const initialEstimate: EstimateFormState = { contract: '', title: '', number: '', status: 'draft', currency: 'RUB' };
function tone(status: string) { if (status === 'approved') return 'success'; if (status === 'under_review') return 'accent'; if (status === 'rejected') return 'danger'; return 'neutral'; }

export default function EstimatesPage() {
  const permissions = useAuthStore((state) => state.permissions);
  const canManageEstimates = Boolean(permissions?.can_manage_estimates);
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editing, setEditing] = useState<Estimate | null>(null);
  const [form, setForm] = useState<EstimateFormState>(initialEstimate);
  const [error, setError] = useState('');

  const { data: estimatesPayload } = useQuery<PaginatedResponse<Estimate>>({ queryKey: ['estimates', search, status], queryFn: () => apiClient.get('/estimates/', { params: { search: search || undefined, status: status || undefined } }).then((response) => response.data) });
  const { data: contractsPayload } = useQuery<PaginatedResponse<Contract>>({ queryKey: ['estimates', 'contracts'], queryFn: () => apiClient.get('/contracts/').then((response) => response.data) });
  const estimates = getResults(estimatesPayload);
  const contracts = getResults(contractsPayload);

  const openCreate = () => { setEditing(null); setForm(initialEstimate); setError(''); setIsFormOpen(true); };
  const openEdit = (estimate: Estimate) => { setEditing(estimate); setForm({ contract: String(estimate.contract), title: estimate.title, number: estimate.number || '', status: estimate.status, currency: estimate.currency || 'RUB' }); setError(''); setIsFormOpen(true); };
  const closeForm = () => { setEditing(null); setForm(initialEstimate); setError(''); setIsFormOpen(false); };
  const saveMutation = useMutation({ mutationFn: () => { const payload = { contract: Number(form.contract), title: form.title, number: form.number, status: form.status, currency: form.currency }; return editing ? apiClient.patch(`/estimates/${editing.id}/`, payload) : apiClient.post('/estimates/', payload); }, onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: ['estimates'] }); closeForm(); }, onError: () => setError('Не удалось сохранить смету. Проверьте договор и обязательные поля.') });

  return <div className="space-y-6">
    <PageIntro eyebrow="Сметы" title="Реестр смет" actions={canManageEstimates ? <Button onClick={openCreate} className="rounded-2xl px-5 py-3"><Plus className="h-4 w-4" />Новая смета</Button> : undefined} />
    <div className="grid gap-4 md:grid-cols-3"><StatCard label="Сметы" value={formatNumber(estimates.length)} hint={`${formatNumber(estimatesPayload?.count)} записей`} tone="brand" icon={<Receipt className="h-5 w-5" />} /><StatCard label="Утверждено" value={formatNumber(estimates.filter((item) => item.status === 'approved').length)} hint="В текущей выборке" tone="accent" icon={<FileSpreadsheet className="h-5 w-5" />} /><StatCard label="Итого" value={formatMoney(estimates.reduce((sum, item) => sum + Number(item.total_amount ?? item.amount ?? 0), 0))} hint="По текущей выборке" tone="neutral" icon={<FileSpreadsheet className="h-5 w-5" />} /></div>
    <SectionCard title="Фильтры"><div className="grid gap-4 md:grid-cols-[1.2fr_0.8fr]"><Field label="Поиск"><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Название, номер или договор" /></Field><Field label="Статус"><Select value={status} onChange={(event) => setStatus(event.target.value)}><option value="">Все статусы</option>{estimateStatusOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</Select></Field></div></SectionCard>
    <SectionCard title="Сметы">
      {estimates.length ? <div className="grid gap-4 xl:grid-cols-2">{estimates.map((estimate) => <div key={estimate.id} className="rounded-[1.8rem] border border-[var(--line)] bg-white/75 p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><Badge tone={tone(estimate.status)}>{estimateStatusOptions.find((item) => item.value === estimate.status)?.label || estimate.status}</Badge><Badge tone="neutral">{estimate.number || 'Без номера'}</Badge></div><h3 className="mt-3 break-words text-lg font-semibold text-[var(--foreground)]">{estimate.title}</h3><p className="mt-1 text-sm text-[var(--muted-foreground)]">{estimate.contract_title || 'Договор не определён'}</p></div><p className="font-semibold text-[var(--foreground)]">{formatMoney(estimate.total_amount ?? estimate.amount, estimate.currency)}</p></div><div className="mt-5 flex flex-wrap gap-2.5"><Link to={`/estimates/${estimate.id}`} className="inline-flex items-center justify-center rounded-full border border-[rgba(31,77,61,0.16)] bg-[rgba(31,77,61,0.08)] px-4 py-2.5 text-sm font-semibold text-[var(--brand)]">Открыть</Link>{canManageEstimates ? <Button variant="secondary" className="px-4" onClick={() => openEdit(estimate)}>Редактировать</Button> : null}</div></div>)}</div> : <EmptyState title="Сметы не найдены" action={canManageEstimates ? <Button onClick={openCreate}>Создать смету</Button> : undefined} />}
    </SectionCard>
    <Modal open={isFormOpen} onClose={closeForm} title={editing ? 'Редактирование сметы' : 'Новая смета'} size="lg"><div className="space-y-5">{error ? <div className="rounded-2xl border border-[rgba(180,79,64,0.18)] bg-[rgba(180,79,64,0.08)] px-4 py-3 text-sm text-[var(--danger)]">{error}</div> : null}<div className="grid gap-4 md:grid-cols-2"><Field label="Договор"><Select value={form.contract} onChange={(event) => setForm((current) => ({ ...current, contract: event.target.value }))}><option value="">Выберите договор</option>{contracts.map((contract) => <option key={contract.id} value={contract.id}>{contract.title}</option>)}</Select></Field><Field label="Статус"><Select value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value as EstimateStatus }))}>{estimateStatusOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</Select></Field><Field label="Название"><Input value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} /></Field><Field label="Номер"><Input value={form.number} onChange={(event) => setForm((current) => ({ ...current, number: event.target.value }))} /></Field><Field label="Валюта"><Input value={form.currency} onChange={(event) => setForm((current) => ({ ...current, currency: event.target.value }))} /></Field></div><div className="flex justify-end gap-3"><Button variant="secondary" onClick={closeForm}>Отмена</Button><Button onClick={() => saveMutation.mutate()} busy={saveMutation.isPending}>Сохранить</Button></div></div></Modal>
  </div>;
}
