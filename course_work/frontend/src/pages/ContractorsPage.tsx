import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Building2, Link2, Network, Plus } from 'lucide-react';
import apiClient from '@/api/client';
import { formatNumber, getResults } from '@/shared/lib/format';
import type { Contractor, PaginatedResponse } from '@/shared/types/domain';
import {
  Badge,
  Button,
  EmptyState,
  Field,
  Input,
  Modal,
  PageIntro,
  SectionCard,
  Select,
  StatCard,
  Textarea,
} from '@/shared/components/ui';
import { useAuthStore } from '@/stores/authStore';

interface ContractorFormState {
  name: string;
  full_name: string;
  inn: string;
  kpp: string;
  ogrn: string;
  address: string;
  phone: string;
  email: string;
  contact_person: string;
  bank_name: string;
  bank_bik: string;
  bank_account: string;
  notes: string;
  is_active: boolean;
}

const initialState: ContractorFormState = {
  name: '',
  full_name: '',
  inn: '',
  kpp: '',
  ogrn: '',
  address: '',
  phone: '',
  email: '',
  contact_person: '',
  bank_name: '',
  bank_bik: '',
  bank_account: '',
  notes: '',
  is_active: true,
};

export default function ContractorsPage() {
  const wizardSteps = [
    { key: 'main', label: 'Основное' },
    { key: 'contacts', label: 'Контакты и адрес' },
    { key: 'bank', label: 'Реквизиты' },
    { key: 'extra', label: 'Дополнительно' },
    { key: 'review', label: 'Проверка' },
  ] as const;
  type WizardStepKey = typeof wizardSteps[number]['key'];

  const queryClient = useQueryClient();
  const permissions = useAuthStore((state) => state.permissions);
  const canManageContractors = Boolean(permissions?.can_manage_contractors);
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState('true');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editing, setEditing] = useState<Contractor | null>(null);
  const [form, setForm] = useState<ContractorFormState>(initialState);
  const [error, setError] = useState('');
  const [stepIndex, setStepIndex] = useState(0);

  const { data: payload } = useQuery<PaginatedResponse<Contractor>>({
    queryKey: ['contractors', 'linked', search, activeFilter],
    queryFn: async () => {
      const response = await apiClient.get('/contractors/', {
        params: {
          search: search || undefined,
          is_active: activeFilter === 'all' ? undefined : activeFilter,
        },
      });
      return response.data;
    },
  });

  const { data: directoryPayload } = useQuery<PaginatedResponse<Contractor>>({
    queryKey: ['contractors', 'directory', search],
    queryFn: async () => {
      const response = await apiClient.get('/contractors/directory/', {
        params: { search: search || undefined },
      });
      return response.data;
    },
  });

  const contractors = getResults(payload);
  const directory = getResults(directoryPayload);
  const activeCount = contractors.filter((item) => item.is_active).length;
  const totalBankProfiles = contractors.filter((item) => item.bank_account && item.bank_bik).length;

  const invalidateAll = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['contractors', 'linked'] }),
      queryClient.invalidateQueries({ queryKey: ['contractors', 'directory'] }),
      queryClient.invalidateQueries({ queryKey: ['contractors', 'internal-organizations'] }),
      queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
      queryClient.invalidateQueries({ queryKey: ['organization'] }),
      queryClient.invalidateQueries({ queryKey: ['contract-create', 'contractors'] }),
    ]);
  };

  const resetModal = () => {
    setEditing(null);
    setForm(initialState);
    setError('');
    setStepIndex(0);
    setIsModalOpen(false);
  };

  const openCreate = () => {
    setEditing(null);
    setForm(initialState);
    setError('');
    setStepIndex(0);
    setIsModalOpen(true);
  };

  const openEdit = (contractor: Contractor) => {
    setEditing(contractor);
    setForm({
      name: contractor.name || '',
      full_name: contractor.full_name || '',
      inn: contractor.inn || '',
      kpp: contractor.kpp || '',
      ogrn: contractor.ogrn || '',
      address: contractor.address || '',
      phone: contractor.phone || '',
      email: contractor.email || '',
      contact_person: contractor.contact_person || '',
      bank_name: contractor.bank_name || '',
      bank_bik: contractor.bank_bik || '',
      bank_account: contractor.bank_account || '',
      notes: contractor.notes || '',
      is_active: contractor.is_active,
    });
    setError('');
    setStepIndex(0);
    setIsModalOpen(true);
  };

  const saveMutation = useMutation({
    mutationFn: () => {
      const requestPayload = { ...form };
      return editing
        ? apiClient.patch(`/contractors/${editing.id}/`, requestPayload)
        : apiClient.post('/contractors/', requestPayload);
    },
    onSuccess: async () => {
      await invalidateAll();
      resetModal();
    },
    onError: () => setError('Не удалось сохранить карточку контрагента. Проверьте ИНН и обязательные поля.'),
  });

  const unlinkMutation = useMutation({
    mutationFn: (id: number) => apiClient.delete(`/contractors/${id}/`),
    onSuccess: async () => {
      await invalidateAll();
      if (editing) {
        resetModal();
      }
    },
    onError: () => {
      setError('Не удалось убрать контрагента из Вашей организации. Проверьте, не используется ли он в договорах.');
    },
  });

  const linkExistingMutation = useMutation({
    mutationFn: (contractorId: number) => apiClient.post('/contractors/link_existing/', { contractor_id: contractorId }),
    onSuccess: invalidateAll,
  });



  const activeStep = wizardSteps[stepIndex];
  const isMainStepValid = form.name.trim().length > 0 && form.inn.trim().length > 0;
  const canGoNext = activeStep.key === 'main' ? isMainStepValid : true;

  const goToStep = (index: number) => setStepIndex(Math.max(0, Math.min(index, wizardSteps.length - 1)));
  const goNext = () => goToStep(stepIndex + 1);
  const goBack = () => goToStep(stepIndex - 1);
  const goReview = () => goToStep(wizardSteps.length - 1);

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="Реестр контрагентов"
        title="Глобальный справочник и связи с Вашей организацией"
        description="В системе используется единая карточка контрагента на всю базу данных. Ваша организация связывается с уже существующими контрагентами или создаёт новые карточки."
        actions={canManageContractors ? (
          <Button className="rounded-2xl px-5 py-3" onClick={openCreate}>
            <Plus className="h-4 w-4" />
            Создать глобальную карточку
          </Button>
        ) : undefined}
      />

      <div className="grid gap-4 md:grid-cols-4">
        <StatCard label="Связаны с Вами" value={formatNumber(contractors.length)} hint={`${formatNumber(payload?.count)} в текущей выборке`} tone="brand" icon={<Building2 className="h-5 w-5" />} />
        <StatCard label="Активные связи" value={formatNumber(activeCount)} hint="Контрагенты, доступные для договоров" tone="neutral" icon={<Link2 className="h-5 w-5" />} />
        <StatCard label="Во всём справочнике" value={formatNumber(directoryPayload?.count)} hint="Глобальный реестр БД" tone="accent" icon={<Network className="h-5 w-5" />} />
        <StatCard label="С банковскими реквизитами" value={formatNumber(totalBankProfiles)} hint="Карточки, где заполнены счёт и БИК" tone="danger" icon={<Building2 className="h-5 w-5" />} />
      </div>

      <SectionCard title="Поиск и фильтрация" description="Поиск одновременно работает по Вашему списку и общему справочнику.">
        <div className="grid gap-4 md:grid-cols-[1.25fr_0.75fr]">
          <Field label="Поиск по названию, ИНН, email или контактному лицу">
            <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Например: СтройИнвест" />
          </Field>
          <Field label="Состояние в моём списке">
            <Select value={activeFilter} onChange={(event) => setActiveFilter(event.target.value)}>
              <option value="all">Все связи</option>
              <option value="true">Только активные</option>
              <option value="false">Только неактивные</option>
            </Select>
          </Field>
        </div>
      </SectionCard>

      <SectionCard title="Контрагенты Вашей организации" description="Это контрагенты, которые уже связаны с Вашей организацией и доступны при создании договоров.">
        {contractors.length ? (
          <div className="grid gap-4 xl:grid-cols-2">
            {contractors.map((contractor) => (
              <div
                key={contractor.id}
                className="overflow-hidden rounded-[1.8rem] border border-[var(--line)] bg-white/75 p-5 text-left"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={contractor.is_active ? 'success' : 'neutral'}>
                        {contractor.is_active ? 'Активный' : 'Неактивный'}
                      </Badge>
                      <Badge tone="neutral">{contractor.inn}</Badge>
                      {contractor.linked_organization_name ? <Badge tone="brand">Организация системы</Badge> : null}
                    </div>
                    <h3 className="mt-3 break-words text-lg font-semibold leading-8 text-[var(--foreground)]">{contractor.name}</h3>
                    <p className="mt-1 break-words text-sm text-[var(--muted-foreground)]">
                      {contractor.contact_person || contractor.linked_organization_name || 'Контактное лицо не задано'}
                    </p>
                  </div>
                  <div className="max-w-full min-w-0 space-y-2 text-left text-xs text-[var(--muted-foreground)] md:text-right">
                    <div className="break-words">{contractor.phone || 'Без телефона'}</div>
                    <div className="break-words">{contractor.email || 'Без email'}</div>
                    <div>{formatNumber(contractor.linked_organizations_count)} орг.</div>
                  </div>
                </div>
                <p className="mt-4 line-clamp-2 text-sm leading-7 text-[var(--muted-foreground)]">
                  {contractor.address || contractor.notes || 'Для полноты карточки можно добавить адрес, реквизиты и заметки.'}
                </p>
                {canManageContractors ? (
                  <div className="mt-4">
                    <Button variant="secondary" onClick={() => openEdit(contractor)}>
                      Открыть карточку
                    </Button>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            title="Связанных контрагентов пока нет"
            description="Вы можете создать новую глобальную карточку или привязать готового контрагента из общего справочника."
            action={canManageContractors ? <Button onClick={openCreate}>Создать карточку</Button> : undefined}
          />
        )}
      </SectionCard>

      <SectionCard title="Общий справочник контрагентов" description="Здесь доступны все контрагенты, которые уже существуют в базе данных. Их можно быстро связать с Вашей организацией.">
        {directory.length ? (
          <div className="grid gap-4 xl:grid-cols-2">
            {directory.map((contractor) => (
              <div key={contractor.id} className="overflow-hidden rounded-[1.8rem] border border-[var(--line)] bg-white/70 p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={contractor.is_active ? 'success' : 'neutral'}>
                        {contractor.is_active ? 'Активный' : 'Неактивный'}
                      </Badge>
                      <Badge tone="neutral">{contractor.inn}</Badge>
                      {contractor.linked_organization_name ? <Badge tone="brand">Связан с организацией</Badge> : null}
                    </div>
                    <h3 className="mt-3 break-words text-lg font-semibold leading-8 text-[var(--foreground)]">{contractor.name}</h3>
                    <p className="mt-1 break-words text-sm text-[var(--muted-foreground)]">
                      {contractor.full_name || contractor.source_organization_name || 'Глобальная карточка контрагента'}
                    </p>
                  </div>
                  {contractor.is_linked_to_current_organization ? (
                    <Badge tone="brand">Уже связан</Badge>
                  ) : canManageContractors ? (
                    <Button
                      variant="secondary"
                      onClick={() => linkExistingMutation.mutate(contractor.id)}
                      busy={linkExistingMutation.isPending}
                    >
                      Добавить в мою организацию
                    </Button>
                  ) : (
                    <Badge tone="neutral">Только просмотр</Badge>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState title="В общем справочнике ничего не найдено" description="Попробуйте изменить поисковый запрос или создайте новую глобальную карточку контрагента." />
        )}
      </SectionCard>

      <Modal
        open={isModalOpen}
        onClose={resetModal}
        title={editing ? 'Редактирование глобальной карточки' : 'Новая глобальная карточка'}
        description="Карточка контрагента создаётся в общем справочнике базы данных и одновременно связывается с Вашей организацией."
        size="xl"
      >
        <div className="space-y-5">
          {error ? (
            <div className="rounded-2xl border border-[rgba(180,79,64,0.18)] bg-[rgba(180,79,64,0.08)] px-4 py-3 text-sm text-[var(--danger)]">
              {error}
            </div>
          ) : null}

          <div className="flex flex-wrap gap-2">
            {wizardSteps.map((step, index) => (
              <button
                type="button"
                key={step.key}
                onClick={() => goToStep(index)}
                className={`rounded-full border px-3 py-1.5 text-xs transition ${
                  index === stepIndex
                    ? 'border-[var(--brand)] bg-[rgba(11,94,215,0.12)] text-[var(--brand)]'
                    : 'border-[var(--line)] bg-white text-[var(--muted-foreground)] hover:text-[var(--foreground)]'
                }`}
              >
                {index + 1}. {step.label}
              </button>
            ))}
          </div>

          {activeStep.key === 'main' ? (
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Краткое название">
                <Input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} />
              </Field>
              <Field label="Полное название">
                <Input value={form.full_name} onChange={(event) => setForm((current) => ({ ...current, full_name: event.target.value }))} />
              </Field>
              <Field label="ИНН">
                <Input value={form.inn} onChange={(event) => setForm((current) => ({ ...current, inn: event.target.value }))} />
              </Field>
              <Field label="КПП">
                <Input value={form.kpp} onChange={(event) => setForm((current) => ({ ...current, kpp: event.target.value }))} />
              </Field>
              <Field label="ОГРН">
                <Input value={form.ogrn} onChange={(event) => setForm((current) => ({ ...current, ogrn: event.target.value }))} />
              </Field>
            </div>
          ) : null}

          {activeStep.key === 'contacts' ? (
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Контактное лицо">
                <Input value={form.contact_person} onChange={(event) => setForm((current) => ({ ...current, contact_person: event.target.value }))} />
              </Field>
              <Field label="Телефон">
                <Input value={form.phone} onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))} />
              </Field>
              <Field label="Email">
                <Input type="email" value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} />
              </Field>
              <div className="md:col-span-2">
                <Field label="Адрес">
                  <Textarea value={form.address} onChange={(event) => setForm((current) => ({ ...current, address: event.target.value }))} />
                </Field>
              </div>
            </div>
          ) : null}

          {activeStep.key === 'bank' ? (
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Банк">
                <Input value={form.bank_name} onChange={(event) => setForm((current) => ({ ...current, bank_name: event.target.value }))} />
              </Field>
              <Field label="БИК">
                <Input value={form.bank_bik} onChange={(event) => setForm((current) => ({ ...current, bank_bik: event.target.value }))} />
              </Field>
              <Field label="Расчётный счёт">
                <Input value={form.bank_account} onChange={(event) => setForm((current) => ({ ...current, bank_account: event.target.value }))} />
              </Field>
            </div>
          ) : null}

          {activeStep.key === 'extra' ? (
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Статус карточки">
                <Select value={String(form.is_active)} onChange={(event) => setForm((current) => ({ ...current, is_active: event.target.value === 'true' }))}>
                  <option value="true">Активная</option>
                  <option value="false">Неактивная</option>
                </Select>
              </Field>
              <div className="md:col-span-2">
                <Field label="Примечания">
                  <Textarea value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} />
                </Field>
              </div>
            </div>
          ) : null}

          {activeStep.key === 'review' ? (
            <div className="rounded-2xl border border-[var(--line)] bg-white/70 p-4 text-sm text-[var(--muted-foreground)]">
              <p><strong className="text-[var(--foreground)]">Название:</strong> {form.name || 'Не заполнено'}</p>
              <p><strong className="text-[var(--foreground)]">ИНН:</strong> {form.inn || 'Не заполнено'}</p>
              <p><strong className="text-[var(--foreground)]">Контакт:</strong> {form.contact_person || 'Не заполнено'}</p>
              <p><strong className="text-[var(--foreground)]">Телефон:</strong> {form.phone || 'Не заполнено'}</p>
              <p><strong className="text-[var(--foreground)]">Email:</strong> {form.email || 'Не заполнено'}</p>
              <p><strong className="text-[var(--foreground)]">Банк/счёт:</strong> {form.bank_name || 'Не заполнено'} {form.bank_account ? `(${form.bank_account})` : ''}</p>
            </div>
          ) : null}

          <div className="flex flex-wrap justify-between gap-3">
            <div>
              {editing ? (
                <Button variant="danger" onClick={() => unlinkMutation.mutate(editing.id)} busy={unlinkMutation.isPending}>
                  Убрать из моей организации
                </Button>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-3">
              <Button variant="secondary" onClick={resetModal}>Отмена</Button>
              {stepIndex > 0 ? (
                <Button variant="secondary" onClick={goBack}>Назад</Button>
              ) : null}
              {stepIndex < wizardSteps.length - 1 ? (
                <>
                  {stepIndex < wizardSteps.length - 2 ? (
                    <Button variant="ghost" onClick={goReview}>Пропустить к проверке</Button>
                  ) : null}
                  <Button onClick={goNext} disabled={!canGoNext}>
                    Далее
                  </Button>
                </>
              ) : (
                <Button onClick={() => saveMutation.mutate()} busy={saveMutation.isPending} disabled={!isMainStepValid}>
                  Сохранить карточку
                </Button>
              )}
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}

