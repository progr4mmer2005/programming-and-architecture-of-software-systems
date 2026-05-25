import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarClock, Plus, WalletCards } from 'lucide-react';

import apiClient from '@/api/client';
import { formatDate, formatMoney, getResults } from '@/shared/lib/format';
import type { Act, Contract, ContractStage, PaginatedResponse, Payment, PaymentStatus, PaymentType } from '@/shared/types/domain';
import { paymentStatusOptions, paymentTypeOptions } from '@/shared/types/domain';
import { Badge, Button, DataTable, EmptyState, Field, Input, Modal, PageIntro, SectionCard, Select, StatCard } from '@/shared/components/ui';
import { useAuthStore } from '@/stores/authStore';

interface PaymentFormState { contract: string; stage: string; act: string; type: PaymentType; amount: string; planned_date: string; paid_date: string; status: PaymentStatus; description: string; }
const initialState: PaymentFormState = { contract: '', stage: '', act: '', type: 'planned', amount: '', planned_date: '', paid_date: '', status: 'pending', description: '' };
function tone(status: string) { if (status === 'paid') return 'success'; if (status === 'overdue') return 'danger'; if (status === 'pending') return 'accent'; return 'neutral'; }
const steps = ['База', 'Параметры', 'Даты и проверка'] as const;

export default function PaymentsPage() {
  const permissions = useAuthStore((state) => state.permissions);
  const canManagePayments = Boolean(permissions?.can_manage_payments);
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editing, setEditing] = useState<Payment | null>(null);
  const [form, setForm] = useState<PaymentFormState>(initialState);
  const [error, setError] = useState('');
  const [stepIndex, setStepIndex] = useState(0);

  const { data: paymentsPayload } = useQuery<PaginatedResponse<Payment>>({ queryKey: ['payments'], queryFn: () => apiClient.get('/payments/').then((response) => response.data) });
  const { data: contractsPayload } = useQuery<PaginatedResponse<Contract>>({ queryKey: ['payments', 'contracts'], queryFn: () => apiClient.get('/contracts/').then((response) => response.data) });
  const { data: stagesPayload } = useQuery<PaginatedResponse<ContractStage>>({ queryKey: ['payments', 'stages', form.contract], queryFn: () => apiClient.get('/stages/', { params: { contract: form.contract } }).then((response) => response.data), enabled: Boolean(form.contract) });
  const { data: actsPayload } = useQuery<PaginatedResponse<Act>>({ queryKey: ['payments', 'acts', form.contract], queryFn: () => apiClient.get('/acts/', { params: { contract: form.contract } }).then((response) => response.data), enabled: Boolean(form.contract) });
  const payments = getResults(paymentsPayload);
  const contracts = getResults(contractsPayload);
  const stages = getResults(stagesPayload);
  const acts = getResults(actsPayload);
  const paid = payments.filter((payment) => payment.status === 'paid').reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
  const planned = payments.filter((payment) => payment.type === 'planned').reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
  const overdue = payments.filter((payment) => payment.status === 'overdue').length;

  const openCreate = () => { setEditing(null); setForm(initialState); setError(''); setStepIndex(0); setIsModalOpen(true); };
  const openEdit = (payment: Payment) => { setEditing(payment); setForm({ contract: String(payment.contract), stage: payment.stage ? String(payment.stage) : '', act: payment.act ? String(payment.act) : '', type: payment.type, amount: String(payment.amount || ''), planned_date: payment.planned_date || '', paid_date: payment.paid_date || payment.actual_date || '', status: payment.status, description: payment.description || '' }); setError(''); setStepIndex(0); setIsModalOpen(true); };
  const closeModal = () => { setEditing(null); setForm(initialState); setError(''); setStepIndex(0); setIsModalOpen(false); };
  const saveMutation = useMutation({ mutationFn: () => { const payload = { contract: Number(form.contract), stage: form.stage ? Number(form.stage) : null, act: form.act ? Number(form.act) : null, type: form.type, amount: Number(form.amount || 0), planned_date: form.planned_date || null, paid_date: form.paid_date || null, status: form.status, description: form.description }; return editing ? apiClient.patch(`/payments/${editing.id}/`, payload) : apiClient.post('/payments/', payload); }, onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: ['payments'] }); closeModal(); }, onError: () => setError('Не удалось сохранить платёж. Проверьте договор, сумму и даты.') });

  const validateStep = () => {
    if (stepIndex === 0 && !form.contract) {
      setError('Выберите договор.');
      return false;
    }
    if (stepIndex === 1 && !form.amount) {
      setError('Введите сумму платежа.');
      return false;
    }
    setError('');
    return true;
  };

  return <div className="space-y-6"><PageIntro eyebrow="Платежи" title="Плановые и фактические оплаты" actions={canManagePayments ? <Button onClick={openCreate}><Plus className="h-4 w-4" />Новый платёж</Button> : undefined} />
    <div className="grid gap-4 md:grid-cols-3"><StatCard label="План" value={formatMoney(planned)} hint="Все плановые платежи" tone="accent" icon={<CalendarClock className="h-5 w-5" />} /><StatCard label="Оплачено" value={formatMoney(paid)} hint="Статус Оплачен" tone="brand" icon={<WalletCards className="h-5 w-5" />} /><StatCard label="Просрочено" value={overdue} hint="Требуют внимания" tone="danger" icon={<WalletCards className="h-5 w-5" />} /></div>
    <SectionCard title="Платежи">{payments.length ? <DataTable columns={['Договор', 'Связь', 'Дата', 'Сумма', 'Статус']}>{payments.map((payment) => <tr key={payment.id} className="border-b border-[var(--line)] last:border-none cursor-pointer" onClick={() => canManagePayments && openEdit(payment)}><td className="px-4 py-4"><p className="font-semibold text-[var(--foreground)]">{payment.contract_title || `Договор #${payment.contract}`}</p><p className="text-sm text-[var(--muted-foreground)]">{payment.description || payment.type_display || payment.type}</p></td><td className="px-4 py-4 text-[var(--muted-foreground)]">{payment.act_title || payment.stage_name || 'По договору'}</td><td className="px-4 py-4 text-[var(--muted-foreground)]">{formatDate(payment.paid_date || payment.planned_date)}</td><td className="px-4 py-4 font-semibold text-[var(--foreground)]">{formatMoney(payment.amount)}</td><td className="px-4 py-4"><Badge tone={tone(payment.status)}>{payment.status_display || payment.status}</Badge></td></tr>)}</DataTable> : <EmptyState title="Платежи отсутствуют" action={canManagePayments ? <Button onClick={openCreate}>Добавить платёж</Button> : undefined} />}</SectionCard>
    <Modal open={isModalOpen} onClose={closeModal} title={editing ? 'Редактирование платежа' : 'Новый платёж'} size="lg"><div className="space-y-5">
      <div className="flex flex-wrap gap-2">{steps.map((step, idx) => <button type="button" key={step} onClick={() => setStepIndex(idx)} className={`rounded-full border px-3 py-1.5 text-sm ${stepIndex===idx?'border-[var(--brand)] bg-[rgba(31,77,61,0.1)] text-[var(--brand)]':'border-[var(--line)] bg-white/75 text-[var(--muted-foreground)]'}`}>{idx+1}. {step}</button>)}</div>
      {error ? <div className="rounded-2xl border border-[rgba(180,79,64,0.18)] bg-[rgba(180,79,64,0.08)] px-4 py-3 text-sm text-[var(--danger)]">{error}</div> : null}

      {stepIndex===0 ? <div className="grid gap-4 md:grid-cols-2"><Field label="Договор"><Select value={form.contract} onChange={(event) => setForm((current) => ({ ...current, contract: event.target.value, stage: '', act: '' }))}><option value="">Выберите договор</option>{contracts.map((contract) => <option key={contract.id} value={contract.id}>{contract.title}</option>)}</Select></Field><Field label="Этап"><Select value={form.stage} onChange={(event) => setForm((current) => ({ ...current, stage: event.target.value }))}><option value="">Без этапа</option>{stages.map((stage) => <option key={stage.id} value={stage.id}>{stage.name}</option>)}</Select></Field><Field label="Акт"><Select value={form.act} onChange={(event) => setForm((current) => ({ ...current, act: event.target.value }))}><option value="">Без акта</option>{acts.map((act) => <option key={act.id} value={act.id}>{act.number} - {act.title}</option>)}</Select></Field></div> : null}
      {stepIndex===1 ? <div className="grid gap-4 md:grid-cols-2"><Field label="Тип"><Select value={form.type} onChange={(event) => setForm((current) => ({ ...current, type: event.target.value as PaymentType }))}>{paymentTypeOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</Select></Field><Field label="Статус"><Select value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value as PaymentStatus }))}>{paymentStatusOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</Select></Field><Field label="Сумма"><Input type="number" value={form.amount} onChange={(event) => setForm((current) => ({ ...current, amount: event.target.value }))} /></Field><div className="md:col-span-2"><Field label="Описание"><Input value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} /></Field></div></div> : null}
      {stepIndex===2 ? <div className="grid gap-4 md:grid-cols-2"><Field label="Плановая дата"><Input type="date" value={form.planned_date} onChange={(event) => setForm((current) => ({ ...current, planned_date: event.target.value }))} /></Field><Field label="Дата оплаты"><Input type="date" value={form.paid_date} onChange={(event) => setForm((current) => ({ ...current, paid_date: event.target.value }))} /></Field><div className="md:col-span-2 rounded-xl border border-[var(--line)] bg-white/80 p-4 text-sm"><p><b>Договор:</b> {contracts.find((c)=>String(c.id)===form.contract)?.title || 'Не выбран'}</p><p><b>Сумма:</b> {form.amount || '0'}</p><p><b>Статус:</b> {paymentStatusOptions.find((s)=>s.value===form.status)?.label || form.status}</p></div></div> : null}

      <div className="flex justify-between gap-3"><Button variant="secondary" onClick={closeModal}>Отмена</Button><div className="flex gap-2">{stepIndex>0?<Button variant="secondary" onClick={()=>setStepIndex((s)=>s-1)}>Назад</Button>:null}{stepIndex<steps.length-1?<Button onClick={()=>{ if (validateStep()) setStepIndex((s)=>s+1); }}>Далее</Button>:<Button onClick={() => saveMutation.mutate()} busy={saveMutation.isPending}>Сохранить</Button>}</div></div>
    </div></Modal>
  </div>;
}
