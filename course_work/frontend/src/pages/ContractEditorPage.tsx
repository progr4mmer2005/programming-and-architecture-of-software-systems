import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, CalendarDays, FileText, Landmark } from 'lucide-react';

import apiClient from '@/api/client';
import { formatContractPrice, getResults } from '@/shared/lib/format';
import type { Contract, Contractor, ContractPriceType, ContractStatus, PaginatedResponse, ReferenceEntry, User } from '@/shared/types/domain';
import { contractStatusOptions, priceTypeOptions } from '@/shared/types/domain';
import { Badge, Button, Field, Input, PageIntro, SectionCard, Select, StatCard, Textarea } from '@/shared/components/ui';

interface ContractFormState {
  title: string;
  number: string;
  status: ContractStatus;
  contractor: string;
  price_type: ContractPriceType;
  amount: string;
  currency: string;
  start_date: string;
  end_date: string;
  signing_date: string;
  termination_date: string;
  payment_terms: string;
  description: string;
  responsible: string;
}

type StepId = 'main' | 'finance' | 'dates' | 'review';

const steps: Array<{ id: StepId; title: string }> = [
  { id: 'main', title: 'Основное' },
  { id: 'finance', title: 'Финансы' },
  { id: 'dates', title: 'Сроки и ответственность' },
  { id: 'review', title: 'Проверка' },
];

const initialState: ContractFormState = {
  title: '',
  number: '',
  status: 'draft',
  contractor: '',
  price_type: 'not_specified',
  amount: '',
  currency: 'RUB',
  start_date: '',
  end_date: '',
  signing_date: '',
  termination_date: '',
  payment_terms: '',
  description: '',
  responsible: '',
};

function buildPayload(form: ContractFormState) {
  const hasAmount = form.amount.trim() !== '';
  return {
    title: form.title,
    number: form.number,
    status: form.status,
    contractor: form.contractor ? Number(form.contractor) : null,
    price_type: form.price_type,
    amount: form.price_type === 'not_specified' ? null : hasAmount ? Number(form.amount) : null,
    currency: hasAmount && form.price_type !== 'free' ? form.currency || 'RUB' : form.price_type === 'free' ? null : form.currency || null,
    start_date: form.start_date || null,
    end_date: form.end_date || null,
    signing_date: form.signing_date || null,
    termination_date: form.termination_date || null,
    payment_terms: form.payment_terms,
    description: form.description,
    responsible: form.responsible ? Number(form.responsible) : null,
  };
}

export default function ContractEditorPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<ContractFormState>(initialState);
  const [error, setError] = useState('');
  const [stepIndex, setStepIndex] = useState(0);

  const { data: contractorsPayload } = useQuery<PaginatedResponse<Contractor>>({
    queryKey: ['contract-create', 'contractors'],
    queryFn: () => apiClient.get('/contractors/').then((response) => response.data),
  });

  const { data: usersPayload } = useQuery<PaginatedResponse<User>>({
    queryKey: ['contract-create', 'users'],
    queryFn: () => apiClient.get('/users/').then((response) => response.data),
  });

  const { data: currenciesPayload } = useQuery<PaginatedResponse<ReferenceEntry>>({
    queryKey: ['contract-create', 'currencies'],
    queryFn: () => apiClient.get('/reference-entries/', {
      params: { category: 'currency', is_active: true },
    }).then((response) => response.data),
  });

  const contractors = getResults(contractorsPayload);
  const users = getResults(usersPayload);
  const currencies = getResults(currenciesPayload);
  const selectedContractor = contractors.find((item) => String(item.id) === form.contractor);
  const previewContract = buildPayload(form) as Contract;
  const currentStep = steps[stepIndex];

  const createMutation = useMutation({
    mutationFn: async () => {
      const response = await apiClient.post<Contract>('/contracts/', buildPayload(form));
      return response.data;
    },
    onSuccess: async (contract) => {
      await queryClient.invalidateQueries({ queryKey: ['contracts'] });
      navigate(`/contracts/${contract.id}`);
    },
    onError: () => {
      setError('Не удалось создать договор. Проверьте обязательные поля и доступность серверной части.');
    },
  });

  const handleChange = (field: keyof ContractFormState, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const validateStep = () => {
    if (currentStep.id === 'main') {
      if (!form.title.trim()) {
        setError('Введите название договора.');
        return false;
      }
      if (!form.number.trim()) {
        setError('Введите номер договора.');
        return false;
      }
    }
    setError('');
    return true;
  };

  const goNext = () => {
    if (!validateStep()) return;
    setStepIndex((current) => Math.min(current + 1, steps.length - 1));
  };

  const summary = useMemo(() => ([
    ['Название', form.title || 'Не заполнено'],
    ['Номер', form.number || 'Не заполнено'],
    ['Статус', contractStatusOptions.find((item) => item.value === form.status)?.label || form.status],
    ['Контрагент', selectedContractor?.name || 'Не выбран'],
    ['Стоимость', formatContractPrice(previewContract)],
  ]), [form, previewContract, selectedContractor]);

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="Новый договор"
        title="Создание карточки договора"
        actions={(
          <Button onClick={() => createMutation.mutate()} busy={createMutation.isPending} className="rounded-2xl px-5 py-3" disabled={currentStep.id !== 'review'}>
            Создать договор
            <ArrowRight className="h-4 w-4" />
          </Button>
        )}
      />

      <div className="flex flex-wrap gap-2">
        {steps.map((step, index) => (
          <button
            key={step.id}
            type="button"
            onClick={() => setStepIndex(index)}
            className={`rounded-full border px-3 py-1.5 text-sm ${index === stepIndex ? 'border-[var(--brand)] bg-[rgba(31,77,61,0.1)] text-[var(--brand)]' : 'border-[var(--line)] bg-white/75 text-[var(--muted-foreground)]'}`}
          >
            {index + 1}. {step.title}
          </button>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard label="Стоимость" value={formatContractPrice(previewContract)} hint="Можно оставить незаполненной" tone="accent" icon={<Landmark className="h-5 w-5" />} />
        <StatCard label="Контрагент" value={selectedContractor?.name || 'Не выбран'} hint={selectedContractor?.inn || 'Можно выбрать позднее'} tone="brand" icon={<FileText className="h-5 w-5" />} />
        <StatCard label="Срок" value={form.start_date || form.end_date ? 'Указан' : 'Не указан'} hint="Даты не обязательны" tone="neutral" icon={<CalendarDays className="h-5 w-5" />} />
      </div>

      {error ? <div className="rounded-2xl border border-[rgba(180,79,64,0.18)] bg-[rgba(180,79,64,0.08)] px-4 py-3 text-sm text-[var(--danger)]">{error}</div> : null}

      <SectionCard title={`Шаг ${stepIndex + 1}. ${currentStep.title}`}>
        {currentStep.id === 'main' ? (
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Название договора"><Input value={form.title} onChange={(event) => handleChange('title', event.target.value)} /></Field>
            <Field label="Номер договора"><Input value={form.number} onChange={(event) => handleChange('number', event.target.value)} /></Field>
            <Field label="Статус"><Select value={form.status} onChange={(event) => handleChange('status', event.target.value)}>{contractStatusOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</Select></Field>
            <Field label="Контрагент"><Select value={form.contractor} onChange={(event) => handleChange('contractor', event.target.value)}><option value="">Не выбран</option>{contractors.map((contractor) => <option key={contractor.id} value={contractor.id}>{contractor.name}</option>)}</Select></Field>
            <div className="md:col-span-2"><Field label="Описание"><Textarea value={form.description} onChange={(event) => handleChange('description', event.target.value)} /></Field></div>
          </div>
        ) : null}

        {currentStep.id === 'finance' ? (
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Тип стоимости"><Select value={form.price_type} onChange={(event) => handleChange('price_type', event.target.value)}>{priceTypeOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</Select></Field>
            <Field label="Сумма"><Input type="number" value={form.amount} onChange={(event) => handleChange('amount', event.target.value)} /></Field>
            <Field label="Валюта"><Select value={form.currency} onChange={(event) => handleChange('currency', event.target.value)}>{(currencies.length ? currencies : [{ id: 0, code: 'RUB', label: 'Российский рубль' } as ReferenceEntry]).map((currency) => (<option key={currency.code} value={currency.code}>{currency.code} - {currency.label}</option>))}</Select></Field>
            <div className="md:col-span-2"><Field label="Условия оплаты"><Textarea value={form.payment_terms} onChange={(event) => handleChange('payment_terms', event.target.value)} /></Field></div>
          </div>
        ) : null}

        {currentStep.id === 'dates' ? (
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Ответственный"><Select value={form.responsible} onChange={(event) => handleChange('responsible', event.target.value)}><option value="">Не назначен</option>{users.map((user) => <option key={user.id} value={user.id}>{user.full_name || user.username}</option>)}</Select></Field>
            <div />
            <Field label="Дата начала"><Input type="date" value={form.start_date} onChange={(event) => handleChange('start_date', event.target.value)} /></Field>
            <Field label="Дата окончания"><Input type="date" value={form.end_date} onChange={(event) => handleChange('end_date', event.target.value)} /></Field>
            <Field label="Дата подписания"><Input type="date" value={form.signing_date} onChange={(event) => handleChange('signing_date', event.target.value)} /></Field>
            <Field label="Дата расторжения"><Input type="date" value={form.termination_date} onChange={(event) => handleChange('termination_date', event.target.value)} /></Field>
          </div>
        ) : null}

        {currentStep.id === 'review' ? (
          <div className="space-y-3">
            {summary.map(([label, value]) => (
              <div key={label} className="rounded-2xl border border-[var(--line)] bg-white/75 px-4 py-3">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--muted-foreground)]">{label}</p>
                <p className="mt-2 text-sm text-[var(--foreground)]">{value}</p>
              </div>
            ))}
          </div>
        ) : null}

        <div className="mt-6 flex justify-between gap-3">
          <div>
            <Button variant="secondary" onClick={() => navigate('/contracts')}>Отмена</Button>
          </div>
          <div className="flex gap-2">
            {stepIndex > 0 ? <Button variant="secondary" onClick={() => setStepIndex((current) => Math.max(current - 1, 0))}>Назад</Button> : null}
            {stepIndex < steps.length - 1 ? <Button onClick={goNext}>Далее</Button> : null}
          </div>
        </div>
      </SectionCard>
    </div>
  );
}
