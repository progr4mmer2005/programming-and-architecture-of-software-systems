import { useState } from 'react';
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

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="Новый договор"
        title="Создание карточки договора"
        actions={(
          <Button onClick={() => createMutation.mutate()} busy={createMutation.isPending} className="rounded-2xl px-5 py-3">
            Создать договор
            <ArrowRight className="h-4 w-4" />
          </Button>
        )}
      />

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard label="Стоимость" value={formatContractPrice(previewContract)} hint="Можно оставить незаполненной" tone="accent" icon={<Landmark className="h-5 w-5" />} />
        <StatCard label="Контрагент" value={selectedContractor?.name || 'Не выбран'} hint={selectedContractor?.inn || 'Можно выбрать позднее'} tone="brand" icon={<FileText className="h-5 w-5" />} />
        <StatCard label="Срок" value={form.start_date || form.end_date ? 'Указан' : 'Не указан'} hint="Даты не обязательны" tone="neutral" icon={<CalendarDays className="h-5 w-5" />} />
      </div>

      {error ? <div className="rounded-2xl border border-[rgba(180,79,64,0.18)] bg-[rgba(180,79,64,0.08)] px-4 py-3 text-sm text-[var(--danger)]">{error}</div> : null}

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <SectionCard title="Основные данные">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Название договора">
              <Input value={form.title} onChange={(event) => handleChange('title', event.target.value)} placeholder="Например: поставка и монтаж оборудования" />
            </Field>
            <Field label="Номер договора">
              <Input value={form.number} onChange={(event) => handleChange('number', event.target.value)} placeholder="Д-2026/001" />
            </Field>
            <Field label="Статус">
              <Select value={form.status} onChange={(event) => handleChange('status', event.target.value)}>
                {contractStatusOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </Select>
            </Field>
            <Field label="Контрагент">
              <Select value={form.contractor} onChange={(event) => handleChange('contractor', event.target.value)}>
                <option value="">Не выбран</option>
                {contractors.map((contractor) => <option key={contractor.id} value={contractor.id}>{contractor.name}</option>)}
              </Select>
            </Field>
            <Field label="Тип стоимости">
              <Select value={form.price_type} onChange={(event) => handleChange('price_type', event.target.value)}>
                {priceTypeOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </Select>
            </Field>
            <Field label="Сумма">
              <Input type="number" value={form.amount} onChange={(event) => handleChange('amount', event.target.value)} placeholder="Можно оставить пустым" />
            </Field>
            <Field label="Валюта">
              <Select value={form.currency} onChange={(event) => handleChange('currency', event.target.value)}>
                {(currencies.length ? currencies : [{ id: 0, code: 'RUB', label: 'Российский рубль' } as ReferenceEntry]).map((currency) => (
                  <option key={currency.code} value={currency.code}>{currency.code} - {currency.label}</option>
                ))}
              </Select>
            </Field>
            <Field label="Ответственный">
              <Select value={form.responsible} onChange={(event) => handleChange('responsible', event.target.value)}>
                <option value="">Не назначен</option>
                {users.map((user) => <option key={user.id} value={user.id}>{user.full_name || user.username}</option>)}
              </Select>
            </Field>
            <Field label="Дата начала">
              <Input type="date" value={form.start_date} onChange={(event) => handleChange('start_date', event.target.value)} />
            </Field>
            <Field label="Дата окончания">
              <Input type="date" value={form.end_date} onChange={(event) => handleChange('end_date', event.target.value)} />
            </Field>
            <Field label="Дата подписания">
              <Input type="date" value={form.signing_date} onChange={(event) => handleChange('signing_date', event.target.value)} />
            </Field>
            <Field label="Дата расторжения">
              <Input type="date" value={form.termination_date} onChange={(event) => handleChange('termination_date', event.target.value)} />
            </Field>
            <div className="md:col-span-2">
              <Field label="Условия оплаты">
                <Textarea value={form.payment_terms} onChange={(event) => handleChange('payment_terms', event.target.value)} />
              </Field>
            </div>
            <div className="md:col-span-2">
              <Field label="Описание">
                <Textarea value={form.description} onChange={(event) => handleChange('description', event.target.value)} />
              </Field>
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Предпросмотр">
          <div className="rounded-[1.7rem] border border-[var(--line)] bg-white/80 p-5">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="brand">{contractStatusOptions.find((item) => item.value === form.status)?.label || 'Черновик'}</Badge>
              <Badge tone="neutral">{form.number || 'Без номера'}</Badge>
            </div>
            <h3 className="mt-4 text-xl font-semibold text-[var(--foreground)]">{form.title || 'Название договора'}</h3>
            <p className="mt-3 text-sm font-semibold text-[var(--brand)]">{formatContractPrice(previewContract)}</p>
            <p className="mt-3 text-sm leading-7 text-[var(--muted-foreground)]">{form.description || 'Описание можно добавить позднее.'}</p>
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
