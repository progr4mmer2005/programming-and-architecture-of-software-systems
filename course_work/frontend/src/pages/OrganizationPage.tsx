import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import apiClient from '@/api/client';
import { useAuthStore } from '@/stores/authStore';
import { formatNumber, getResults } from '@/shared/lib/format';
import type { ApprovalRoute, Organization, OrganizationStats, PaginatedResponse, RoleDefinition, User, Invitation } from '@/shared/types/domain';
import { roleLabels, roleOptions } from '@/shared/types/domain';
import {
  Badge,
  Button,
  Checkbox,
  EmptyState,
  Field,
  Input,
  LoadingBlock,
  Modal,
  PageIntro,
  SectionCard,
  Select,
  StatCard,
  Textarea,
} from '@/shared/components/ui';

const permissionLabels: Record<string, string> = {
  can_view_dashboard: 'Просмотр главной',
  can_view_contracts: 'Просмотр договоров',
  can_manage_contracts: 'Управление договорами',
  can_launch_approval: 'Запуск согласования',
  can_view_contractors: 'Просмотр контрагентов',
  can_manage_contractors: 'Управление контрагентами',
  can_view_templates: 'Просмотр шаблонов',
  can_manage_templates: 'Управление шаблонами',
  can_view_estimates: 'Просмотр смет',
  can_manage_estimates: 'Управление сметами',
  can_view_approvals: 'Просмотр согласований',
  can_manage_approval_routes: 'Управление маршрутами согласования',
  can_process_approval_tasks: 'Обработка задач согласования',
  can_view_payments: 'Просмотр платежей',
  can_manage_payments: 'Управление платежами',
  can_view_calendar: 'Просмотр календаря',
  can_view_reports: 'Просмотр отчётов',
  can_view_organization: 'Просмотр организации',
  can_manage_organization: 'Управление организацией',
  can_manage_users: 'Управление пользователями',
  can_manage_references: 'Управление НСИ',
  can_view_audit: 'Просмотр аудита',
  scoped_to_assigned_contracts: 'Доступ только к назначенным договорам',
};

const permissionKeys = Object.keys(permissionLabels);
const protectedRoleCodes = new Set(['user', 'super_admin']);

function createPermissionDraft(initial?: Record<string, boolean>) {
  return permissionKeys.reduce<Record<string, boolean>>((acc, key) => {
    acc[key] = Boolean(initial?.[key]);
    return acc;
  }, {});
}

interface RouteWizardFormState {
  name: string;
  is_active: boolean;
  stages: Array<{ name: string; role: string; assigned_to: number | null; order: number }>;
}

const initialRouteForm: RouteWizardFormState = {
  name: '',
  is_active: true,
  stages: [
    { name: 'Первичная проверка', role: '', assigned_to: null, order: 1 },
    { name: 'Финальное утверждение', role: '', assigned_to: null, order: 2 },
  ],
};

export default function OrganizationPage() {
  const queryClient = useQueryClient();
  const permissions = useAuthStore((state) => state.permissions);
  const currentUser = useAuthStore((state) => state.user);

  const [error, setError] = useState('');
  const [organizationForm, setOrganizationForm] = useState<Partial<Organization>>({});
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRoleId, setInviteRoleId] = useState<number | null>(null);
  const [newRoleName, setNewRoleName] = useState('');
  const [newRoleCode, setNewRoleCode] = useState('');
  const [editingRoleId, setEditingRoleId] = useState<number | null>(null);
  const [editingPermissions, setEditingPermissions] = useState<Record<string, boolean>>(createPermissionDraft());
  const [isRouteModalOpen, setIsRouteModalOpen] = useState(false);
  const [editingRoute, setEditingRoute] = useState<ApprovalRoute | null>(null);
  const [routeError, setRouteError] = useState('');
  const [routeStepIndex, setRouteStepIndex] = useState(0);
  const [routeForm, setRouteForm] = useState<RouteWizardFormState>(initialRouteForm);

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

  const { data: rolesPayload } = useQuery<PaginatedResponse<RoleDefinition> | RoleDefinition[]>({
    queryKey: ['organization', 'roles'],
    queryFn: () => apiClient.get('/roles/').then((response) => response.data),
  });

  const { data: invitationsPayload } = useQuery<PaginatedResponse<Invitation>>({
    queryKey: ['organization', 'invitations'],
    queryFn: () => apiClient.get('/invitations/').then((response) => response.data),
    enabled: Boolean(permissions?.can_manage_users),
  });
  const { data: routesPayload } = useQuery<PaginatedResponse<ApprovalRoute>>({
    queryKey: ['organization', 'approval-routes'],
    queryFn: () => apiClient.get('/approval-routes/').then((response) => response.data),
    enabled: Boolean(permissions?.can_manage_approval_routes || permissions?.can_view_approvals),
  });

  const organization = getResults(organizationPayload)[0];
  const users = getResults(usersPayload);
  const roles = getResults(rolesPayload);
  const assignableRoles = useMemo(() => roles.filter((role) => role.code !== 'super_admin'), [roles]);
  const invitations = getResults(invitationsPayload);
  const routes = getResults(routesPayload);

  useEffect(() => {
    if (!organization) return;
    setOrganizationForm({
      name: organization.name,
      legal_name: organization.legal_name,
      inn: organization.inn,
      kpp: organization.kpp,
      ogrn: organization.ogrn,
      address: organization.address,
      is_active: organization.is_active,
    });
  }, [organization]);

  useEffect(() => {
    if (roles.length && inviteRoleId === null) {
      const defaultRole = assignableRoles.find((role) => role.code === 'user') || assignableRoles[0];
      if (defaultRole) {
        setInviteRoleId(defaultRole.id);
      }
    }
  }, [assignableRoles, roles.length, inviteRoleId]);

  const roleMap = useMemo(() => {
    return roles.reduce<Record<number, RoleDefinition>>((acc, role) => {
      acc[role.id] = role;
      return acc;
    }, {});
  }, [roles]);
  const editingRole = editingRoleId ? roleMap[editingRoleId] : undefined;
  const editingRoleIsProtected = Boolean(editingRole && protectedRoleCodes.has(editingRole.code));

  const saveOrganizationMutation = useMutation({
    mutationFn: () => apiClient.patch(`/organizations/${organization?.id}/`, organizationForm),
    onSuccess: async () => {
      setError('');
      await queryClient.invalidateQueries({ queryKey: ['organization'] });
      await queryClient.invalidateQueries({ queryKey: ['organization', 'stats'] });
    },
    onError: () => setError('Не удалось сохранить организацию.'),
  });

  const inviteMutation = useMutation({
    mutationFn: () => apiClient.post('/invitations/', { email: inviteEmail, role_id: inviteRoleId }),
    onSuccess: async () => {
      setInviteEmail('');
      await queryClient.invalidateQueries({ queryKey: ['organization', 'invitations'] });
    },
    onError: () => setError('Не удалось отправить приглашение.'),
  });

  const changeRoleMutation = useMutation({
    mutationFn: ({ userId, roleId }: { userId: number; roleId: number }) => apiClient.post(`/users/${userId}/change_role/`, { role_id: roleId }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['organization', 'users'] });
    },
    onError: () => setError('Не удалось назначить роль пользователю.'),
  });

  const setUserActiveMutation = useMutation({
    mutationFn: ({ userId, isActive }: { userId: number; isActive: boolean }) => apiClient.post(`/users/${userId}/set_active/`, { is_active: isActive }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['organization', 'users'] });
    },
    onError: () => setError('Не удалось изменить статус пользователя.'),
  });

  const createRoleMutation = useMutation({
    mutationFn: () => apiClient.post('/roles/', {
      name: newRoleName,
      code: newRoleCode || undefined,
      permissions: createPermissionDraft(),
    }),
    onSuccess: async () => {
      setNewRoleName('');
      setNewRoleCode('');
      await queryClient.invalidateQueries({ queryKey: ['organization', 'roles'] });
    },
    onError: () => setError('Не удалось создать роль.'),
  });

  const updateRoleMutation = useMutation({
    mutationFn: ({ roleId, payload }: { roleId: number; payload: Partial<RoleDefinition> }) => apiClient.patch(`/roles/${roleId}/`, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['organization', 'roles'] });
      setEditingRoleId(null);
    },
    onError: () => setError('Не удалось обновить роль.'),
  });

  const deleteRoleMutation = useMutation({
    mutationFn: (roleId: number) => apiClient.delete(`/roles/${roleId}/`),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['organization', 'roles'] });
    },
    onError: () => setError('Не удалось удалить роль.'),
  });

  const routeSteps = [
    { key: 'main', label: 'Основное' },
    { key: 'stages', label: 'Этапы' },
    { key: 'review', label: 'Проверка' },
  ] as const;
  const activeRouteStep = routeSteps[routeStepIndex];

  const openCreateRoute = () => {
    setEditingRoute(null);
    setRouteForm(initialRouteForm);
    setRouteError('');
    setRouteStepIndex(0);
    setIsRouteModalOpen(true);
  };
  const openEditRoute = (route: ApprovalRoute) => {
    setEditingRoute(route);
    setRouteForm({
      name: route.name,
      is_active: route.is_active,
      stages: (route.stages || []).length
        ? route.stages.map((stage, idx) => ({
          name: stage.name || `Этап ${idx + 1}`,
          role: stage.role || '',
          assigned_to: stage.assigned_to || null,
          order: stage.order || idx + 1,
        }))
        : initialRouteForm.stages,
    });
    setRouteError('');
    setRouteStepIndex(0);
    setIsRouteModalOpen(true);
  };
  const closeRouteModal = () => {
    setEditingRoute(null);
    setRouteForm(initialRouteForm);
    setRouteError('');
    setRouteStepIndex(0);
    setIsRouteModalOpen(false);
  };
  const routeMainValid = routeForm.name.trim().length > 0;
  const routeStagesValid = routeForm.stages.length > 0
    && routeForm.stages.every((stage) => stage.name.trim() && stage.assigned_to);

  const saveRouteMutation = useMutation({
    mutationFn: () => {
      const payload = {
        name: routeForm.name,
        is_active: routeForm.is_active,
        stages: routeForm.stages
          .slice()
          .sort((a, b) => a.order - b.order)
          .map((stage, index) => ({
            name: stage.name,
            role: stage.role || '',
            assigned_to: stage.assigned_to,
            order: Number(stage.order || index + 1),
          })),
      };
      return editingRoute
        ? apiClient.patch(`/approval-routes/${editingRoute.id}/`, payload)
        : apiClient.post('/approval-routes/', payload);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['organization', 'approval-routes'] });
      await queryClient.invalidateQueries({ queryKey: ['approval-routes'] });
      closeRouteModal();
    },
    onError: () => setRouteError('Не удалось сохранить маршрут. Проверьте заполнение шагов.'),
  });

  const deleteRouteMutation = useMutation({
    mutationFn: (routeId: number) => apiClient.delete(`/approval-routes/${routeId}/`),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['organization', 'approval-routes'] });
      await queryClient.invalidateQueries({ queryKey: ['approval-routes'] });
      closeRouteModal();
    },
    onError: () => setRouteError('Не удалось удалить маршрут.'),
  });

  if (!organization) {
    return <LoadingBlock label="Загружаем организацию..." />;
  }

  return (
    <div className="space-y-6">
      <PageIntro eyebrow="Организация" title="Команда, приглашения и роли" />

      {error ? (
        <div className="rounded-2xl border border-[rgba(180,79,64,0.18)] bg-[rgba(180,79,64,0.08)] px-4 py-3 text-sm text-[var(--danger)]">
          {error}
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard label="Пользователи" value={formatNumber(stats?.members_count)} tone="brand" />
        <StatCard label="Договоры" value={formatNumber(stats?.contracts_count)} tone="accent" />
        <StatCard label="Контрагенты" value={formatNumber(stats?.contractors_count)} tone="neutral" />
      </div>

      <SectionCard
        title="Профиль организации"
        action={permissions?.can_manage_organization ? (
          <Button busy={saveOrganizationMutation.isPending} onClick={() => saveOrganizationMutation.mutate()}>
            Сохранить
          </Button>
        ) : undefined}
      >
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Название"><Input value={organizationForm.name || ''} onChange={(event) => setOrganizationForm((prev) => ({ ...prev, name: event.target.value }))} disabled={!permissions?.can_manage_organization} /></Field>
          <Field label="Юридическое название"><Input value={organizationForm.legal_name || ''} onChange={(event) => setOrganizationForm((prev) => ({ ...prev, legal_name: event.target.value }))} disabled={!permissions?.can_manage_organization} /></Field>
          <Field label="ИНН"><Input value={organizationForm.inn || ''} onChange={(event) => setOrganizationForm((prev) => ({ ...prev, inn: event.target.value }))} disabled={!permissions?.can_manage_organization} /></Field>
          <Field label="КПП"><Input value={organizationForm.kpp || ''} onChange={(event) => setOrganizationForm((prev) => ({ ...prev, kpp: event.target.value }))} disabled={!permissions?.can_manage_organization} /></Field>
          <Field label="ОГРН"><Input value={organizationForm.ogrn || ''} onChange={(event) => setOrganizationForm((prev) => ({ ...prev, ogrn: event.target.value }))} disabled={!permissions?.can_manage_organization} /></Field>
          <Field label="Статус">
            <Select
              value={String(organizationForm.is_active ?? true)}
              onChange={(event) => setOrganizationForm((prev) => ({ ...prev, is_active: event.target.value === 'true' }))}
              disabled={!permissions?.can_manage_organization}
            >
              <option value="true">Активна</option>
              <option value="false">Отключена</option>
            </Select>
          </Field>
          <div className="md:col-span-2">
            <Field label="Адрес">
              <Textarea value={organizationForm.address || ''} onChange={(event) => setOrganizationForm((prev) => ({ ...prev, address: event.target.value }))} disabled={!permissions?.can_manage_organization} />
            </Field>
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Команда">
        {users.length ? (
          <div className="space-y-3">
            {users.map((user) => {
              const selectedRoleId = user.org_role_id || roles.find((role) => role.code === user.org_role)?.id || 0;
              const isCurrentUser = currentUser?.id === user.id;
              const isUserSuperAdmin = user.org_role === 'super_admin' || user.role === 'super_admin';
              const isCurrentUserSuperAdmin = isCurrentUser && isUserSuperAdmin;
              return (
                <div key={user.id} className="grid gap-4 rounded-2xl border border-[var(--line)] bg-white/80 p-4 md:grid-cols-[1fr_18rem_14rem] md:items-end">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-[var(--foreground)]">{user.full_name || user.username}</p>
                      {isCurrentUser ? <Badge tone="brand">Вы</Badge> : null}
                      {isCurrentUserSuperAdmin ? <Badge tone="neutral">Самозащита включена</Badge> : null}
                    </div>
                    <p className="text-xs text-[var(--muted-foreground)]">{user.email || 'Без email'}</p>
                    <p className="mt-1 text-xs text-[var(--muted-foreground)]">Текущая роль: {user.org_role_name || user.org_role || user.role}</p>
                    {isCurrentUserSuperAdmin ? (
                      <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                        Главный админ не может удалить, деактивировать или разжаловать самого себя.
                      </p>
                    ) : null}
                  </div>

                  <Field label="Роль в организации">
                    <Select
                      value={String(selectedRoleId || '')}
                      disabled={!permissions?.can_manage_users || isCurrentUserSuperAdmin || isUserSuperAdmin}
                      onChange={(event) => changeRoleMutation.mutate({ userId: user.id, roleId: Number(event.target.value) })}
                    >
                      {assignableRoles.map((role) => (
                        <option key={role.id} value={role.id}>{role.name}</option>
                      ))}
                    </Select>
                  </Field>

                  <Field label="Учётная запись">
                    <Select
                      value={String(user.is_active !== false)}
                      disabled={!permissions?.can_manage_users || isCurrentUserSuperAdmin || isUserSuperAdmin}
                      onChange={(event) => setUserActiveMutation.mutate({ userId: user.id, isActive: event.target.value === 'true' })}
                    >
                      <option value="true">Активна</option>
                      <option value="false">Отключена</option>
                    </Select>
                  </Field>
                </div>
              );
            })}
          </div>
        ) : (
          <EmptyState title="Пользователей пока нет" />
        )}
      </SectionCard>

      {permissions?.can_manage_users ? (
        <SectionCard title="Приглашение пользователя" action={<Badge tone="accent">Роль по умолчанию: Пользователь</Badge>}>
          <div className="grid gap-4 md:grid-cols-[1fr_18rem_auto] md:items-end">
            <Field label="Email пользователя">
              <Input type="email" value={inviteEmail} onChange={(event) => setInviteEmail(event.target.value)} placeholder="name@example.com" />
            </Field>
            <Field label="Роль в организации">
              <Select value={String(inviteRoleId || '')} onChange={(event) => setInviteRoleId(Number(event.target.value))}>
                {assignableRoles.map((role) => (
                  <option key={role.id} value={role.id}>{role.name}</option>
                ))}
              </Select>
            </Field>
            <Button busy={inviteMutation.isPending} onClick={() => inviteMutation.mutate()}>
              Отправить приглашение
            </Button>
          </div>

          {invitations.length ? (
            <div className="mt-6 space-y-2">
              {invitations.map((invitation) => (
                <div key={invitation.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--line)] bg-white/75 px-4 py-3">
                  <div>
                    <p className="text-sm font-semibold text-[var(--foreground)]">{invitation.email}</p>
                    <p className="text-xs text-[var(--muted-foreground)]">Роль: {invitation.role_name} • Статус: {invitation.status}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </SectionCard>
      ) : null}

      {(permissions?.can_manage_approval_routes || permissions?.can_view_approvals) ? (
        <SectionCard
          title="Маршруты согласования"
          description="Маршруты создаются на уровне текущей организации и доступны только её участникам."
          action={permissions?.can_manage_approval_routes ? <Button onClick={openCreateRoute}>Новый маршрут</Button> : undefined}
        >
          {routes.length ? (
            <div className="grid gap-4 xl:grid-cols-2">
              {routes.map((route) => (
                <button
                  key={route.id}
                  type="button"
                  onClick={() => permissions?.can_manage_approval_routes && openEditRoute(route)}
                  className="rounded-2xl border border-[var(--line)] bg-white/75 p-4 text-left"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={route.is_active ? 'success' : 'neutral'}>{route.is_active ? 'Активен' : 'Отключен'}</Badge>
                    <Badge tone="neutral">{route.stages?.length || 0} этапа</Badge>
                  </div>
                  <p className="mt-2 text-sm font-semibold text-[var(--foreground)]">{route.name}</p>
                  <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                    {(route.stages || []).map((s) => `${s.order}. ${s.name} (${s.assigned_to_name || roleLabels[s.role] || s.role || 'исполнитель'})`).join(' -> ')}
                  </p>
                </button>
              ))}
            </div>
          ) : (
            <EmptyState title="Маршрутов пока нет" description="Создайте первый маршрут согласования для этой организации." />
          )}
        </SectionCard>
      ) : null}

      {permissions?.can_manage_users ? (
        <SectionCard title="Роли и матрица доступа">
          <div className="grid gap-6 lg:grid-cols-[22rem_1fr]">
            <div className="space-y-4 rounded-2xl border border-[var(--line)] bg-white/75 p-4">
              <Field label="Название роли">
                <Input value={newRoleName} onChange={(event) => setNewRoleName(event.target.value)} placeholder="Например, Юрист" />
              </Field>
              <Field label="Код роли (опционально)">
                <Input value={newRoleCode} onChange={(event) => setNewRoleCode(event.target.value)} placeholder="lawyer" />
              </Field>
              <Button busy={createRoleMutation.isPending} onClick={() => createRoleMutation.mutate()}>
                Создать роль
              </Button>

              <div className="space-y-2 pt-2">
                {roles.map((role) => (
                  <button
                    key={role.id}
                    type="button"
                    onClick={() => {
                      setEditingRoleId(role.id);
                      setEditingPermissions(createPermissionDraft(role.permissions));
                    }}
                    className={`w-full rounded-xl border px-3 py-2 text-left text-sm transition ${editingRoleId === role.id ? 'border-[var(--brand)] bg-[rgba(31,77,61,0.08)]' : 'border-[var(--line)] bg-white/70 hover:bg-white'}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-[var(--foreground)]">{role.name}</span>
                      {protectedRoleCodes.has(role.code) ? <Badge tone="neutral">Защищённая</Badge> : null}
                    </div>
                    <p className="mt-1 text-xs text-[var(--muted-foreground)]">{role.code}</p>
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-[var(--line)] bg-white/75 p-4">
              {editingRoleId ? (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-[var(--foreground)]">
                      Редактирование роли: {editingRole?.name}
                    </p>
                    <div className="flex gap-2">
                      {!editingRoleIsProtected ? (
                        <Button variant="danger" busy={deleteRoleMutation.isPending} onClick={() => deleteRoleMutation.mutate(editingRoleId)}>
                          Удалить роль
                        </Button>
                      ) : null}
                      <Button
                        disabled={editingRoleIsProtected}
                        busy={updateRoleMutation.isPending}
                        onClick={() => updateRoleMutation.mutate({ roleId: editingRoleId, payload: { permissions: editingPermissions } })}
                      >
                        Сохранить матрицу
                      </Button>
                    </div>
                  </div>
                  {editingRoleIsProtected ? (
                    <div className="rounded-xl border border-[var(--line)] bg-white/80 px-4 py-3 text-sm text-[var(--muted-foreground)]">
                      Роли "Пользователь" и "Главный админ" защищены: их нельзя редактировать или удалять.
                    </div>
                  ) : null}

                  <div className="grid gap-3 md:grid-cols-2">
                    {permissionKeys.map((key) => (
                      <Checkbox
                        key={key}
                        label={permissionLabels[key] || key}
                        checked={Boolean(editingPermissions[key])}
                        onChange={(checked) => {
                          if (editingRoleIsProtected) return;
                          setEditingPermissions((prev) => ({ ...prev, [key]: checked }));
                        }}
                        description={editingRoleIsProtected ? 'Для этой роли изменение недоступно.' : undefined}
                      />
                    ))}
                  </div>
                </div>
              ) : (
                <EmptyState title="Выберите роль слева, чтобы редактировать матрицу прав" />
              )}
            </div>
          </div>
        </SectionCard>
      ) : null}

      <Modal
        open={isRouteModalOpen}
        onClose={closeRouteModal}
        title={editingRoute ? 'Редактирование маршрута согласования' : 'Новый маршрут согласования'}
        description="Настройте шаги маршрута. Можно выбрать роль и конкретного сотрудника."
        size="xl"
      >
        <div className="space-y-4">
          {routeError ? <div className="rounded-2xl border border-[rgba(180,79,64,0.18)] bg-[rgba(180,79,64,0.08)] px-4 py-3 text-sm text-[var(--danger)]">{routeError}</div> : null}
          <div className="flex flex-wrap gap-2">
            {routeSteps.map((step, idx) => (
              <button key={step.key} type="button" onClick={() => setRouteStepIndex(idx)} className={`rounded-full border px-3 py-1.5 text-xs ${idx === routeStepIndex ? 'border-[var(--brand)] bg-[rgba(31,77,61,0.08)] text-[var(--brand)]' : 'border-[var(--line)] bg-white text-[var(--muted-foreground)]'}`}>
                {idx + 1}. {step.label}
              </button>
            ))}
          </div>

          {activeRouteStep.key === 'main' ? (
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Название маршрута"><Input value={routeForm.name} onChange={(event) => setRouteForm((prev) => ({ ...prev, name: event.target.value }))} /></Field>
              <Field label="Статус">
                <Select value={String(routeForm.is_active)} onChange={(event) => setRouteForm((prev) => ({ ...prev, is_active: event.target.value === 'true' }))}>
                  <option value="true">Активен</option>
                  <option value="false">Отключен</option>
                </Select>
              </Field>
            </div>
          ) : null}

          {activeRouteStep.key === 'stages' ? (
            <div className="space-y-3">
              {routeForm.stages.map((stage, index) => {
                const usersForRole = stage.role
                  ? users.filter((u) => (u.org_role || u.role) === stage.role && u.is_active !== false)
                  : users.filter((u) => u.is_active !== false);
                return (
                  <div key={`${index}-${stage.order}`} className="grid gap-3 rounded-2xl border border-[var(--line)] bg-white/75 p-3 md:grid-cols-[0.2fr_0.8fr_0.8fr_0.9fr_auto]">
                    <Field label="Порядок"><Input type="number" value={stage.order} onChange={(event) => setRouteForm((prev) => ({ ...prev, stages: prev.stages.map((s, i) => i === index ? { ...s, order: Number(event.target.value || s.order) } : s) }))} /></Field>
                    <Field label="Название"><Input value={stage.name} onChange={(event) => setRouteForm((prev) => ({ ...prev, stages: prev.stages.map((s, i) => i === index ? { ...s, name: event.target.value } : s) }))} /></Field>
                    <Field label="Роль">
                      <Select value={stage.role || ''} onChange={(event) => setRouteForm((prev) => ({ ...prev, stages: prev.stages.map((s, i) => i === index ? { ...s, role: event.target.value, assigned_to: null } : s) }))}>
                        <option value="">Не выбрана (вся команда)</option>
                        {roleOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                      </Select>
                    </Field>
                    <Field label="Сотрудник">
                      <Select value={String(stage.assigned_to || '')} onChange={(event) => setRouteForm((prev) => ({ ...prev, stages: prev.stages.map((s, i) => i === index ? { ...s, assigned_to: Number(event.target.value) || null } : s) }))}>
                        <option value="">Выберите сотрудника</option>
                        {usersForRole.map((u) => <option key={u.id} value={u.id}>{u.full_name || u.username}</option>)}
                      </Select>
                    </Field>
                    <div className="self-end">{routeForm.stages.length > 1 ? <Button variant="ghost" onClick={() => setRouteForm((prev) => ({ ...prev, stages: prev.stages.filter((_, i) => i !== index) }))}>Убрать</Button> : null}</div>
                  </div>
                );
              })}
              <Button variant="secondary" onClick={() => setRouteForm((prev) => ({ ...prev, stages: [...prev.stages, { name: 'Новый этап', role: '', assigned_to: null, order: prev.stages.length + 1 }] }))}>Добавить этап</Button>
            </div>
          ) : null}

          {activeRouteStep.key === 'review' ? (
            <div className="rounded-2xl border border-[var(--line)] bg-white/70 p-4 text-sm text-[var(--muted-foreground)]">
              <p><strong className="text-[var(--foreground)]">Маршрут:</strong> {routeForm.name || 'Не заполнено'}</p>
              <p className="mt-2"><strong className="text-[var(--foreground)]">Шаги:</strong></p>
              <div className="mt-1 space-y-1">
                {routeForm.stages.slice().sort((a, b) => a.order - b.order).map((stage) => {
                  const assigned = users.find((u) => u.id === stage.assigned_to);
                  return <p key={`${stage.order}-${stage.name}`}>{stage.order}. {stage.name} - {stage.role ? (roleLabels[stage.role] || stage.role) : 'Любая роль'} - {assigned?.full_name || assigned?.username || 'Не выбран'}</p>;
                })}
              </div>
            </div>
          ) : null}

          <div className="flex flex-wrap justify-between gap-3">
            <div>{editingRoute ? <Button variant="danger" onClick={() => deleteRouteMutation.mutate(editingRoute.id)} busy={deleteRouteMutation.isPending}>Удалить</Button> : null}</div>
            <div className="flex flex-wrap gap-3">
              <Button variant="secondary" onClick={closeRouteModal}>Отмена</Button>
              {routeStepIndex > 0 ? <Button variant="secondary" onClick={() => setRouteStepIndex((s) => s - 1)}>Назад</Button> : null}
              {routeStepIndex < routeSteps.length - 1 ? (
                <Button
                  onClick={() => setRouteStepIndex((s) => s + 1)}
                  disabled={(activeRouteStep.key === 'main' && !routeMainValid) || (activeRouteStep.key === 'stages' && !routeStagesValid)}
                >
                  Далее
                </Button>
              ) : (
                <Button onClick={() => saveRouteMutation.mutate()} busy={saveRouteMutation.isPending} disabled={!routeMainValid || !routeStagesValid}>Сохранить маршрут</Button>
              )}
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
