import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Building2, Plus, UsersRound, Wallet } from 'lucide-react';
import apiClient from '@/api/client';
import { formatNumber, getResults } from '@/shared/lib/format';
import { useAuthStore } from '@/stores/authStore';
import type {
  Organization,
  OrganizationStats,
  PaginatedResponse,
  ReferenceEntry,
  User,
} from '@/shared/types/domain';
import { roleOptions } from '@/shared/types/domain';
import {
  Badge,
  Button,
  EmptyState,
  Field,
  Input,
  LoadingBlock,
  Modal,
  PageIntro,
  SectionCard,
  Select,
  StatCard,
  Tabs,
  Textarea,
} from '@/shared/components/ui';

type OrganizationTab = 'profile' | 'team' | 'references';

interface OrganizationFormState {
  name: string;
  legal_name: string;
  inn: string;
  kpp: string;
  ogrn: string;
  address: string;
  is_active: boolean;
}

interface InviteFormState {
  username: string;
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  patronymic: string;
  role: string;
  phone: string;
  position: string;
}

interface ReferenceFormState {
  id?: number;
  category: string;
  code: string;
  label: string;
  description: string;
  sort_order: string;
  is_active: boolean;
  metadata_rate: string;
}

interface OrganizationPermissions {
  canManageOrganization: boolean;
  canManageUsers: boolean;
  canManageReferences: boolean;
}

const emptyInvite: InviteFormState = {
  username: '',
  email: '',
  password: '',
  first_name: '',
  last_name: '',
  patronymic: '',
  role: 'manager',
  phone: '',
  position: '',
};

const emptyReference: ReferenceFormState = {
  category: 'currency',
  code: '',
  label: '',
  description: '',
  sort_order: '100',
  is_active: true,
  metadata_rate: '',
};

function ReadonlyField({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[1.5rem] border border-[var(--line)] bg-white/75 p-4">
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--muted-foreground)]">{label}</p>
      <p className="mt-3 break-words text-sm leading-7 text-[var(--foreground)]">{value || 'Не заполнено'}</p>
    </div>
  );
}

function OrganizationContent({
  organization,
  users,
  stats,
  references,
  access,
}: {
  organization: Organization;
  users: User[];
  stats?: OrganizationStats;
  references: ReferenceEntry[];
  access: OrganizationPermissions;
}) {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<OrganizationTab>('profile');
  const [organizationForm, setOrganizationForm] = useState<OrganizationFormState>({
    name: organization.name || '',
    legal_name: organization.legal_name || '',
    inn: organization.inn || '',
    kpp: organization.kpp || '',
    ogrn: organization.ogrn || '',
    address: organization.address || '',
    is_active: organization.is_active,
  });
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [inviteForm, setInviteForm] = useState<InviteFormState>(emptyInvite);
  const [isReferenceOpen, setIsReferenceOpen] = useState(false);
  const [referenceForm, setReferenceForm] = useState<ReferenceFormState>(emptyReference);
  const [error, setError] = useState('');
  const [roleDrafts, setRoleDrafts] = useState<Record<number, string>>({});

  const groupedReferences = useMemo(() => ({
    currency: references.filter((item) => item.category === 'currency'),
    contract_status: references.filter((item) => item.category === 'contract_status'),
  }), [references]);

  const openReferenceCreate = (category: string) => {
    if (!access.canManageReferences) {
      return;
    }
    setReferenceForm({ ...emptyReference, category });
    setIsReferenceOpen(true);
  };

  const openReferenceEdit = (reference: ReferenceEntry) => {
    if (!access.canManageReferences) {
      return;
    }
    setReferenceForm({
      id: reference.id,
      category: reference.category,
      code: reference.code,
      label: reference.label,
      description: reference.description || '',
      sort_order: String(reference.sort_order || 100),
      is_active: reference.is_active,
      metadata_rate: String(reference.metadata?.rate ?? ''),
    });
    setIsReferenceOpen(true);
  };

  const saveOrganizationMutation = useMutation({
    mutationFn: () => apiClient.patch(`/organizations/${organization.id}/`, organizationForm),
    onSuccess: async () => {
      setError('');
      await queryClient.invalidateQueries({ queryKey: ['organization'] });
      await queryClient.invalidateQueries({ queryKey: ['organization', 'stats'] });
    },
    onError: () => setError('Не удалось сохранить профиль организации.'),
  });

  const inviteMutation = useMutation({
    mutationFn: () => apiClient.post('/users/', inviteForm),
    onSuccess: async () => {
      setInviteForm(emptyInvite);
      setIsInviteOpen(false);
      await queryClient.invalidateQueries({ queryKey: ['organization', 'users'] });
      await queryClient.invalidateQueries({ queryKey: ['organization', 'stats'] });
    },
    onError: () => setError('Не удалось создать пользователя. Проверьте логин, email и пароль.'),
  });

  const changeRoleMutation = useMutation({
    mutationFn: ({ userId, role }: { userId: number; role: string }) => apiClient.post(`/users/${userId}/change_role/`, { role }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['organization', 'users'] });
    },
  });

  const changeActivityMutation = useMutation({
    mutationFn: ({ userId, isActive }: { userId: number; isActive: boolean }) => apiClient.post(`/users/${userId}/set_active/`, { is_active: isActive }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['organization', 'users'] });
    },
  });

  const saveReferenceMutation = useMutation({
    mutationFn: () => {
      const payload = {
        category: referenceForm.category,
        code: referenceForm.code,
        label: referenceForm.label,
        description: referenceForm.description,
        sort_order: Number(referenceForm.sort_order || 100),
        is_active: referenceForm.is_active,
        metadata: referenceForm.category === 'currency' && referenceForm.metadata_rate
          ? { rate: Number(referenceForm.metadata_rate) }
          : {},
      };
      return referenceForm.id
        ? apiClient.patch(`/reference-entries/${referenceForm.id}/`, payload)
        : apiClient.post('/reference-entries/', payload);
    },
    onSuccess: async () => {
      setIsReferenceOpen(false);
      setReferenceForm(emptyReference);
      await queryClient.invalidateQueries({ queryKey: ['organization', 'references'] });
    },
  });

  const renderReferenceList = (items: ReferenceEntry[], kind: 'currency' | 'contract_status') => {
    if (!items.length) {
      return null;
    }

    return (
      <div className="grid gap-3 xl:grid-cols-2">
        {items.map((reference) => {
          const content = (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-[var(--foreground)]">
                      {kind === 'currency' ? `${reference.code} - ${reference.label}` : reference.label}
                    </p>
                    <Badge tone={reference.is_active ? 'success' : 'neutral'}>
                      {kind === 'currency' ? (reference.is_active ? 'Активна' : 'Отключена') : reference.code}
                    </Badge>
                  </div>
                  <p className="mt-2 text-xs leading-6 text-[var(--muted-foreground)]">
                    {reference.description || 'Описание не заполнено.'}
                  </p>
                </div>
                {kind === 'currency' ? (
                  <p className="text-sm font-semibold text-[var(--foreground)]">Курс: {String(reference.metadata?.rate ?? '-')}</p>
                ) : null}
              </div>
            </>
          );

          if (!access.canManageReferences) {
            return (
              <div key={reference.id} className="rounded-[1.5rem] border border-[var(--line)] bg-white/75 px-4 py-4">
                {content}
              </div>
            );
          }

          return (
            <button
              key={reference.id}
              type="button"
              onClick={() => openReferenceEdit(reference)}
              className="rounded-[1.5rem] border border-[var(--line)] bg-white/75 px-4 py-4 text-left transition hover:border-[var(--line-strong)] hover:bg-white"
            >
              {content}
            </button>
          );
        })}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="Профиль компании"
        title="Организация и справочники"
        description="Раздел объединяет сведения о компании, состав команды и системные справочники. Для ролей с просмотром он открыт как справочная витрина без управляющих действий."
        actions={access.canManageUsers ? <Button onClick={() => setIsInviteOpen(true)} className="rounded-2xl px-5 py-3"><Plus className="h-4 w-4" />Новый пользователь</Button> : undefined}
      />

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard label="Пользователи" value={formatNumber(stats?.members_count)} hint={`${users.filter((user) => user.is_active !== false).length} активных`} tone="brand" icon={<UsersRound className="h-5 w-5" />} />
        <StatCard label="Договоры" value={formatNumber(stats?.contracts_count)} hint="По текущей организации" tone="accent" icon={<Wallet className="h-5 w-5" />} />
        <StatCard label="Контрагенты" value={formatNumber(stats?.contractors_count)} hint="Контрагенты в справочнике" tone="neutral" icon={<Building2 className="h-5 w-5" />} />
      </div>

      {error ? (
        <div className="rounded-2xl border border-[rgba(180,79,64,0.18)] bg-[rgba(180,79,64,0.08)] px-4 py-3 text-sm text-[var(--danger)]">
          {error}
        </div>
      ) : null}

      <Tabs
        value={tab}
        onChange={setTab}
        items={[
          { value: 'profile', label: 'Профиль', badge: <Badge tone="brand">Организация</Badge> },
          { value: 'team', label: 'Команда', badge: <Badge tone="neutral">{users.length}</Badge> },
          { value: 'references', label: 'Справочники', badge: <Badge tone="accent">{references.length}</Badge> },
        ]}
      />

      {tab === 'profile' ? (
        access.canManageOrganization ? (
          <SectionCard title="Профиль организации" description="Юридические данные организации, которые используются в карточках договоров и административных отчётах." action={<Button onClick={() => saveOrganizationMutation.mutate()} busy={saveOrganizationMutation.isPending}>Сохранить профиль</Button>}>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Название">
                <Input value={organizationForm.name} onChange={(event) => setOrganizationForm((current) => ({ ...current, name: event.target.value }))} />
              </Field>
              <Field label="Юридическое название">
                <Input value={organizationForm.legal_name} onChange={(event) => setOrganizationForm((current) => ({ ...current, legal_name: event.target.value }))} />
              </Field>
              <Field label="ИНН">
                <Input value={organizationForm.inn} onChange={(event) => setOrganizationForm((current) => ({ ...current, inn: event.target.value }))} />
              </Field>
              <Field label="КПП">
                <Input value={organizationForm.kpp} onChange={(event) => setOrganizationForm((current) => ({ ...current, kpp: event.target.value }))} />
              </Field>
              <Field label="ОГРН">
                <Input value={organizationForm.ogrn} onChange={(event) => setOrganizationForm((current) => ({ ...current, ogrn: event.target.value }))} />
              </Field>
              <Field label="Статус">
                <Select value={String(organizationForm.is_active)} onChange={(event) => setOrganizationForm((current) => ({ ...current, is_active: event.target.value === 'true' }))}>
                  <option value="true">Активна</option>
                  <option value="false">Отключена</option>
                </Select>
              </Field>
              <div className="md:col-span-2">
                <Field label="Адрес">
                  <Textarea value={organizationForm.address} onChange={(event) => setOrganizationForm((current) => ({ ...current, address: event.target.value }))} />
                </Field>
              </div>
            </div>
          </SectionCard>
        ) : (
          <SectionCard title="Профиль организации" description="У Вас открыт режим просмотра. Ниже показаны актуальные сведения по компании без возможности их изменить.">
            <div className="grid gap-4 md:grid-cols-2">
              <ReadonlyField label="Название" value={organization.name || ''} />
              <ReadonlyField label="Юридическое название" value={organization.legal_name || ''} />
              <ReadonlyField label="ИНН" value={organization.inn || ''} />
              <ReadonlyField label="КПП" value={organization.kpp || ''} />
              <ReadonlyField label="ОГРН" value={organization.ogrn || ''} />
              <ReadonlyField label="Статус" value={organization.is_active ? 'Активна' : 'Отключена'} />
              <div className="md:col-span-2">
                <ReadonlyField label="Адрес" value={organization.address || ''} />
              </div>
            </div>
          </SectionCard>
        )
      ) : null}

      {tab === 'team' ? (
        <SectionCard title="Команда и права доступа" description={access.canManageUsers ? 'Для каждого сотрудника доступны роль, состояние учётной записи и базовые контактные данные.' : 'У Вас открыт режим просмотра. Здесь можно ознакомиться с составом команды и назначенными ролями.'}>
          {users.length ? (
            <div className="space-y-3">
              {users.map((user) => (
                <div key={user.id} className="grid gap-4 rounded-[1.6rem] border border-[var(--line)] bg-white/75 p-4 lg:grid-cols-[1fr_0.8fr_0.8fr_auto] lg:items-center">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-[var(--foreground)]">{user.full_name || user.username}</p>
                      <Badge tone={user.is_active === false ? 'neutral' : 'success'}>
                        {user.is_active === false ? 'Отключён' : 'Активен'}
                      </Badge>
                    </div>
                    <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                      {user.email || 'Без email'} • {user.position || 'Должность не указана'}
                    </p>
                  </div>

                  {access.canManageUsers ? (
                    <>
                      <Field label="Роль">
                        <Select value={roleDrafts[user.id] ?? user.role} onChange={(event) => setRoleDrafts((current) => ({ ...current, [user.id]: event.target.value }))}>
                          {roleOptions.map((option) => (
                            <option key={option.value} value={option.value}>{option.label}</option>
                          ))}
                        </Select>
                      </Field>
                      <Field label="Учётная запись">
                        <Select value={String(user.is_active !== false)} onChange={(event) => changeActivityMutation.mutate({ userId: user.id, isActive: event.target.value === 'true' })}>
                          <option value="true">Активна</option>
                          <option value="false">Отключена</option>
                        </Select>
                      </Field>
                      <div className="self-end lg:self-auto">
                        <Button
                          variant="secondary"
                          onClick={() => changeRoleMutation.mutate({ userId: user.id, role: roleDrafts[user.id] ?? user.role })}
                          busy={changeRoleMutation.isPending}
                        >
                          Сохранить роль
                        </Button>
                      </div>
                    </>
                  ) : (
                    <>
                      <div>
                        <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--muted-foreground)]">Роль</p>
                        <p className="mt-3 text-sm font-semibold text-[var(--foreground)]">{roleOptions.find((item) => item.value === user.role)?.label || user.role}</p>
                      </div>
                      <div>
                        <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--muted-foreground)]">Учётная запись</p>
                        <p className="mt-3 text-sm font-semibold text-[var(--foreground)]">{user.is_active === false ? 'Отключена' : 'Активна'}</p>
                      </div>
                      <div className="self-end lg:self-auto">
                        <Badge tone="neutral">Только просмотр</Badge>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              title="Пользователи пока не созданы"
              description="После добавления первого пользователя здесь будет доступен состав команды и назначенные роли."
              action={access.canManageUsers ? <Button onClick={() => setIsInviteOpen(true)}>Добавить пользователя</Button> : undefined}
            />
          )}
        </SectionCard>
      ) : null}

      {tab === 'references' ? (
        <div className="space-y-6">
          <SectionCard title="Валюты и курсы" description={access.canManageReferences ? 'Справочник валют используется в карточках договоров и отчётах.' : 'У Вас открыт режим просмотра. Здесь можно увидеть актуальные валюты и курсы, которые применяются в системе.'} action={access.canManageReferences ? <Button onClick={() => openReferenceCreate('currency')}><Plus className="h-4 w-4" />Добавить валюту</Button> : undefined}>
            {groupedReferences.currency.length ? renderReferenceList(groupedReferences.currency, 'currency') : (
              <EmptyState title="Справочник валют пуст" description="После добавления валют здесь будут доступны коды и курсы для договоров и финансовых отчётов." />
            )}
          </SectionCard>

          <SectionCard title="Статусы договоров" description={access.canManageReferences ? 'Справочник статусов отражает допустимые состояния жизненного цикла договора.' : 'У Вас открыт режим просмотра. Здесь можно увидеть, какие статусы предусмотрены для карточек договоров.'} action={access.canManageReferences ? <Button onClick={() => openReferenceCreate('contract_status')}><Plus className="h-4 w-4" />Добавить статус</Button> : undefined}>
            {groupedReferences.contract_status.length ? renderReferenceList(groupedReferences.contract_status, 'contract_status') : (
              <EmptyState title="Статусы договоров пока не созданы" description="После заполнения справочника здесь появятся рабочие статусы жизненного цикла договора." />
            )}
          </SectionCard>
        </div>
      ) : null}

      {access.canManageUsers ? (
        <Modal
          open={isInviteOpen}
          onClose={() => {
            setIsInviteOpen(false);
            setInviteForm(emptyInvite);
          }}
          title="Новый пользователь"
          description="Создание участника команды в рамках текущей организации."
          size="xl"
        >
          <div className="space-y-5">
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Логин">
                <Input value={inviteForm.username} onChange={(event) => setInviteForm((current) => ({ ...current, username: event.target.value }))} />
              </Field>
              <Field label="Email">
                <Input type="email" value={inviteForm.email} onChange={(event) => setInviteForm((current) => ({ ...current, email: event.target.value }))} />
              </Field>
              <Field label="Пароль">
                <Input type="password" value={inviteForm.password} onChange={(event) => setInviteForm((current) => ({ ...current, password: event.target.value }))} />
              </Field>
              <Field label="Роль">
                <Select value={inviteForm.role} onChange={(event) => setInviteForm((current) => ({ ...current, role: event.target.value }))}>
                  {roleOptions.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </Select>
              </Field>
              <Field label="Имя">
                <Input value={inviteForm.first_name} onChange={(event) => setInviteForm((current) => ({ ...current, first_name: event.target.value }))} />
              </Field>
              <Field label="Фамилия">
                <Input value={inviteForm.last_name} onChange={(event) => setInviteForm((current) => ({ ...current, last_name: event.target.value }))} />
              </Field>
              <Field label="Отчество">
                <Input value={inviteForm.patronymic} onChange={(event) => setInviteForm((current) => ({ ...current, patronymic: event.target.value }))} />
              </Field>
              <Field label="Телефон">
                <Input value={inviteForm.phone} onChange={(event) => setInviteForm((current) => ({ ...current, phone: event.target.value }))} />
              </Field>
              <Field label="Должность">
                <Input value={inviteForm.position} onChange={(event) => setInviteForm((current) => ({ ...current, position: event.target.value }))} />
              </Field>
            </div>

            <div className="flex justify-end gap-3">
              <Button variant="secondary" onClick={() => {
                setIsInviteOpen(false);
                setInviteForm(emptyInvite);
              }}>
                Отмена
              </Button>
              <Button onClick={() => inviteMutation.mutate()} busy={inviteMutation.isPending}>
                Создать пользователя
              </Button>
            </div>
          </div>
        </Modal>
      ) : null}

      {access.canManageReferences ? (
        <Modal
          open={isReferenceOpen}
          onClose={() => {
            setIsReferenceOpen(false);
            setReferenceForm(emptyReference);
          }}
          title={referenceForm.id ? 'Редактирование элемента НСИ' : 'Новый элемент НСИ'}
          description="В этой форме можно создать или изменить запись нормативно-справочной информации."
          size="lg"
        >
          <div className="space-y-5">
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Категория">
                <Select value={referenceForm.category} onChange={(event) => setReferenceForm((current) => ({ ...current, category: event.target.value }))}>
                  <option value="currency">Валюты</option>
                  <option value="contract_status">Статусы договоров</option>
                </Select>
              </Field>
              <Field label="Код">
                <Input value={referenceForm.code} onChange={(event) => setReferenceForm((current) => ({ ...current, code: event.target.value }))} />
              </Field>
              <Field label="Наименование">
                <Input value={referenceForm.label} onChange={(event) => setReferenceForm((current) => ({ ...current, label: event.target.value }))} />
              </Field>
              <Field label="Порядок">
                <Input type="number" value={referenceForm.sort_order} onChange={(event) => setReferenceForm((current) => ({ ...current, sort_order: event.target.value }))} />
              </Field>
              {referenceForm.category === 'currency' ? (
                <Field label="Курс">
                  <Input type="number" value={referenceForm.metadata_rate} onChange={(event) => setReferenceForm((current) => ({ ...current, metadata_rate: event.target.value }))} />
                </Field>
              ) : null}
              <Field label="Статус">
                <Select value={String(referenceForm.is_active)} onChange={(event) => setReferenceForm((current) => ({ ...current, is_active: event.target.value === 'true' }))}>
                  <option value="true">Активен</option>
                  <option value="false">Отключён</option>
                </Select>
              </Field>
              <div className="md:col-span-2">
                <Field label="Описание">
                  <Textarea value={referenceForm.description} onChange={(event) => setReferenceForm((current) => ({ ...current, description: event.target.value }))} />
                </Field>
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <Button variant="secondary" onClick={() => {
                setIsReferenceOpen(false);
                setReferenceForm(emptyReference);
              }}>
                Отмена
              </Button>
              <Button onClick={() => saveReferenceMutation.mutate()} busy={saveReferenceMutation.isPending}>
                Сохранить элемент
              </Button>
            </div>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}

export default function OrganizationPage() {
  const permissions = useAuthStore((state) => state.permissions);

  const { data: organizationPayload } = useQuery<PaginatedResponse<Organization>>({
    queryKey: ['organization'],
    queryFn: () => apiClient.get('/organizations/').then((response) => response.data),
  });

  const { data: stats } = useQuery<OrganizationStats>({
    queryKey: ['organization', 'stats'],
    queryFn: () => apiClient.get('/organizations/stats/').then((response) => response.data),
  });

  const { data: usersPayload } = useQuery<PaginatedResponse<User>>({
    queryKey: ['organization', 'users'],
    queryFn: () => apiClient.get('/users/').then((response) => response.data),
  });

  const { data: referencesPayload } = useQuery<PaginatedResponse<ReferenceEntry>>({
    queryKey: ['organization', 'references'],
    queryFn: () => apiClient.get('/reference-entries/').then((response) => response.data),
  });

  const organization = getResults(organizationPayload)[0];
  const users = getResults(usersPayload);
  const references = getResults(referencesPayload);

  if (!organization) {
    return <LoadingBlock label="Загружаем профиль организации..." />;
  }

  return (
    <OrganizationContent
      key={organization.id}
      organization={organization}
      users={users}
      stats={stats}
      references={references}
      access={{
        canManageOrganization: Boolean(permissions?.can_manage_organization),
        canManageUsers: Boolean(permissions?.can_manage_users),
        canManageReferences: Boolean(permissions?.can_manage_references),
      }}
    />
  );
}

