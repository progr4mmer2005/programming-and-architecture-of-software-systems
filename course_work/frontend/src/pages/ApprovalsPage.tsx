import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { GitBranchPlus, Plus, ShieldCheck, Workflow } from 'lucide-react';
import apiClient from '@/api/client';
import { useAuthStore } from '@/stores/authStore';
import { buildStagePreview, formatDate, getResults, summarizeStages } from '@/shared/lib/format';
import type {
  ApprovalRoute,
  ApprovalTask,
  PaginatedResponse,
} from '@/shared/types/domain';
import { approvalStatusOptions, roleOptions } from '@/shared/types/domain';
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
  Tabs,
  Textarea,
} from '@/shared/components/ui';

type PageTab = 'tasks' | 'routes';
type ApprovalActionType = 'approve' | 'reject';

interface RouteFormState {
  name: string;
  is_active: boolean;
  stages: Array<{ name: string; role: string; order: number }>;
}

const initialRoute: RouteFormState = {
  name: '',
  is_active: true,
  stages: [
    { name: 'Проверка', role: 'approver', order: 1 },
    { name: 'Утверждение', role: 'director', order: 2 },
  ],
};

function getTaskTone(status: string) {
  if (status === 'approved') {
    return 'success';
  }
  if (status === 'rejected') {
    return 'danger';
  }
  if (status === 'waiting') {
    return 'neutral';
  }
  return 'accent';
}

export default function ApprovalsPage() {
  const user = useAuthStore((state) => state.user);
  const permissions = useAuthStore((state) => state.permissions);
  const canManageRoutes = Boolean(permissions?.can_manage_approval_routes);
  const canProcessTasks = Boolean(permissions?.can_process_approval_tasks);
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<PageTab>('tasks');
  const [statusFilter, setStatusFilter] = useState('');
  const [isRouteModalOpen, setIsRouteModalOpen] = useState(false);
  const [editingRoute, setEditingRoute] = useState<ApprovalRoute | null>(null);
  const [routeForm, setRouteForm] = useState<RouteFormState>(initialRoute);
  const [routeError, setRouteError] = useState('');
  const [taskAction, setTaskAction] = useState<{ task: ApprovalTask; action: ApprovalActionType } | null>(null);
  const [taskComment, setTaskComment] = useState('');

  const { data: tasksPayload } = useQuery<PaginatedResponse<ApprovalTask>>({
    queryKey: ['approval-tasks', user?.id, statusFilter],
    queryFn: () => apiClient.get('/approval-tasks/', {
      params: { status: statusFilter || undefined },
    }).then((response) => response.data),
  });

  const { data: routesPayload } = useQuery<PaginatedResponse<ApprovalRoute>>({
    queryKey: ['approval-routes'],
    queryFn: () => apiClient.get('/approval-routes/').then((response) => response.data),
  });

  const tasks = getResults(tasksPayload);
  const routes = getResults(routesPayload);

  const openCreate = () => {
    setEditingRoute(null);
    setRouteForm(initialRoute);
    setRouteError('');
    setIsRouteModalOpen(true);
  };

  const openEdit = (route: ApprovalRoute) => {
    setEditingRoute(route);
    setRouteForm({
      name: route.name,
      is_active: route.is_active,
      stages: route.stages?.length
        ? route.stages.map((stage) => ({ name: stage.name, role: stage.role, order: stage.order }))
        : initialRoute.stages,
    });
    setRouteError('');
    setIsRouteModalOpen(true);
  };

  const closeRouteModal = () => {
    setEditingRoute(null);
    setRouteForm(initialRoute);
    setRouteError('');
    setIsRouteModalOpen(false);
  };

  const saveRouteMutation = useMutation({
    mutationFn: () => {
      const payload = {
        name: routeForm.name,
        is_active: routeForm.is_active,
        stages: routeForm.stages
          .slice()
          .sort((left, right) => left.order - right.order)
          .map((stage) => ({ ...stage })),
      };
      return editingRoute
        ? apiClient.patch(`/approval-routes/${editingRoute.id}/`, payload)
        : apiClient.post('/approval-routes/', payload);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['approval-routes'] });
      closeRouteModal();
    },
    onError: () => setRouteError('Не удалось сохранить маршрут. Проверь название и состав этапов.'),
  });

  const deleteRouteMutation = useMutation({
    mutationFn: (id: number) => apiClient.delete(`/approval-routes/${id}/`),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['approval-routes'] });
      closeRouteModal();
    },
  });

  const taskActionMutation = useMutation({
    mutationFn: () => {
      if (!taskAction) {
        throw new Error('task-missing');
      }
      return apiClient.post(`/approval-tasks/${taskAction.task.id}/${taskAction.action}/`, {
        comment: taskComment,
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['approval-tasks', user?.id] });
      setTaskAction(null);
      setTaskComment('');
    },
  });

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="Workflow"
        title="Согласование"
        description="Раздел предназначен для управления маршрутами утверждения и задачами согласования по ролям."
        actions={canManageRoutes ? <Button onClick={openCreate} className="rounded-2xl px-5 py-3"><Plus className="h-4 w-4" />Новый маршрут</Button> : undefined}
      />

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard label="Задачи" value={tasks.length} hint={`${tasks.filter((item) => item.status === 'pending').length} ожидают решения`} tone="brand" icon={<ShieldCheck className="h-5 w-5" />} />
        <StatCard label="Маршруты" value={routes.length} hint={`${routes.filter((item) => item.is_active).length} активных`} tone="accent" icon={<GitBranchPlus className="h-5 w-5" />} />
        <StatCard label="Этапы" value={routes.reduce((sum, item) => sum + (item.stages?.length ?? 0), 0)} hint="Суммарный состав маршрутов" tone="neutral" icon={<Workflow className="h-5 w-5" />} />
      </div>

      <Tabs
        value={tab}
        onChange={(value) => setTab(value as PageTab)}
        items={[
          { value: 'tasks', label: 'Задачи', badge: <Badge tone="accent">{tasks.length}</Badge> },
          ...(canManageRoutes ? [{ value: 'routes', label: 'Маршруты', badge: <Badge tone="neutral">{routes.length}</Badge> }] : []),
        ]}
      />

      {tab === 'tasks' ? (
        <SectionCard title="Задачи согласования" description="Здесь доступны фильтрация задач и принятие решений по текущим этапам маршрутов.">
          <div className="mb-4 grid gap-4 md:grid-cols-[0.7fr_1.3fr]">
            <Field label="Статус">
              <Select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                <option value="">Все статусы</option>
                {approvalStatusOptions.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </Select>
            </Field>
          </div>

          {tasks.length ? (
            <div className="space-y-3">
              {tasks.map((task) => (
                <div key={task.id} className="rounded-[1.7rem] border border-[var(--line)] bg-white/75 p-5">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge tone={getTaskTone(task.status)}>
                          {task.status_display || task.status}
                        </Badge>
                        <Badge tone="neutral">Этап {task.stage_order}</Badge>
                        {task.route_name ? <Badge tone="neutral">{task.route_name}</Badge> : null}
                      </div>
                      <h3 className="mt-3 text-lg font-semibold text-[var(--foreground)]">{task.contract_title || 'Без договора'}</h3>
                      <p className="mt-1 text-sm text-[var(--muted-foreground)]">
                        {task.assigned_to_name || 'Исполнитель не назначен'} • Роль: {roleOptions.find((item) => item.value === task.role)?.label || task.role}
                      </p>
                      <p className="mt-3 text-sm leading-7 text-[var(--muted-foreground)]">
                        {task.comment || 'Комментарий к задаче пока не добавлен.'}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-3">
                      {task.status === 'pending' && canProcessTasks ? (
                        <>
                          <Button variant="secondary" onClick={() => setTaskAction({ task, action: 'reject' })}>
                            Отклонить
                          </Button>
                          <Button onClick={() => setTaskAction({ task, action: 'approve' })}>
                            Согласовать
                          </Button>
                        </>
                      ) : task.status === 'waiting' ? (
                        <p className="text-xs text-[var(--muted-foreground)]">
                          Этап будет открыт автоматически после завершения предыдущих согласований.
                        </p>
                      ) : task.status === 'pending' ? (
                        <p className="text-xs text-[var(--muted-foreground)]">
                          Решение по задачам доступно только назначенному согласующему.
                        </p>
                      ) : (
                        <p className="text-xs text-[var(--muted-foreground)]">
                          Завершено {formatDate(task.completed_at || task.assigned_at, true)}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState title="Задач не найдено" description="По текущему фильтру задачи не найдены. Измените параметры отбора или создайте маршрут согласования." />
          )}
        </SectionCard>
      ) : canManageRoutes ? (
        <SectionCard title="Маршруты согласования" description="Здесь можно настроить стандартные цепочки ролей для разных сценариев согласования.">
          {routes.length ? (
            <div className="grid gap-4 xl:grid-cols-2">
              {routes.map((route) => (
                <button
                  key={route.id}
                  type="button"
                  onClick={() => openEdit(route)}
                  className="rounded-[1.8rem] border border-[var(--line)] bg-white/75 p-5 text-left transition hover:border-[var(--line-strong)] hover:bg-white"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={route.is_active ? 'success' : 'neutral'}>
                      {route.is_active ? 'Активен' : 'Отключен'}
                    </Badge>
                    <Badge tone="neutral">{route.stages?.length || 0} этапа</Badge>
                  </div>
                  <h3 className="mt-3 text-lg font-semibold text-[var(--foreground)]">{route.name}</h3>
                  <p className="mt-2 text-sm leading-7 text-[var(--muted-foreground)]">{summarizeStages(route.stages)}</p>
                </button>
              ))}
            </div>
          ) : (
            <EmptyState title="Маршрутов пока нет" description="После создания первого маршрута здесь будет доступна настройка ролевых шагов для типовых договоров." action={<Button onClick={openCreate}>Создать маршрут</Button>} />
          )}
        </SectionCard>
      ) : null}

      <Modal
        open={isRouteModalOpen}
        onClose={closeRouteModal}
        title={editingRoute ? 'Редактирование маршрута' : 'Новый маршрут'}
        description="Укажите роли, порядок и наименования шагов. Маршрут можно отключить без удаления."
        size="xl"
      >
        <div className="space-y-5">
          {routeError ? (
            <div className="rounded-2xl border border-[rgba(180,79,64,0.18)] bg-[rgba(180,79,64,0.08)] px-4 py-3 text-sm text-[var(--danger)]">
              {routeError}
            </div>
          ) : null}

          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Название маршрута">
              <Input value={routeForm.name} onChange={(event) => setRouteForm((current) => ({ ...current, name: event.target.value }))} />
            </Field>
            <Field label="Статус">
              <Select value={String(routeForm.is_active)} onChange={(event) => setRouteForm((current) => ({ ...current, is_active: event.target.value === 'true' }))}>
                <option value="true">Активен</option>
                <option value="false">Отключен</option>
              </Select>
            </Field>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-[var(--foreground)]">Этапы маршрута</h3>
              <Button
                variant="secondary"
                onClick={() => setRouteForm((current) => ({
                  ...current,
                  stages: [
                    ...current.stages,
                    { name: 'Новый этап', role: 'manager', order: current.stages.length + 1 },
                  ],
                }))}
              >
                Добавить этап
              </Button>
            </div>

            {buildStagePreview(routeForm.stages).map((stage, index) => (
              <div key={stage.key} className="grid gap-4 rounded-[1.5rem] border border-[var(--line)] bg-white/75 p-4 md:grid-cols-[0.22fr_0.78fr_0.8fr_auto]">
                <Field label="Порядок">
                  <Input
                    type="number"
                    value={routeForm.stages[index].order}
                    onChange={(event) => setRouteForm((current) => ({
                      ...current,
                      stages: current.stages.map((item, itemIndex) => itemIndex === index ? { ...item, order: Number(event.target.value || item.order) } : item),
                    }))}
                  />
                </Field>
                <Field label="Название">
                  <Input
                    value={routeForm.stages[index].name}
                    onChange={(event) => setRouteForm((current) => ({
                      ...current,
                      stages: current.stages.map((item, itemIndex) => itemIndex === index ? { ...item, name: event.target.value } : item),
                    }))}
                  />
                </Field>
                <Field label="Роль">
                  <Select
                    value={routeForm.stages[index].role}
                    onChange={(event) => setRouteForm((current) => ({
                      ...current,
                      stages: current.stages.map((item, itemIndex) => itemIndex === index ? { ...item, role: event.target.value } : item),
                    }))}
                  >
                    {roleOptions.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </Select>
                </Field>
                <div className="self-end">
                  <Button
                    variant="ghost"
                    onClick={() => setRouteForm((current) => ({
                      ...current,
                      stages: current.stages.filter((_, itemIndex) => itemIndex !== index),
                    }))}
                  >
                    Убрать
                  </Button>
                </div>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap justify-between gap-3">
            <div>
              {editingRoute ? (
                <Button variant="danger" onClick={() => deleteRouteMutation.mutate(editingRoute.id)} busy={deleteRouteMutation.isPending}>
                  Удалить
                </Button>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-3">
              <Button variant="secondary" onClick={closeRouteModal}>Отмена</Button>
              <Button onClick={() => saveRouteMutation.mutate()} busy={saveRouteMutation.isPending}>Сохранить маршрут</Button>
            </div>
          </div>
        </div>
      </Modal>

      <Modal
        open={Boolean(taskAction)}
        onClose={() => {
          setTaskAction(null);
          setTaskComment('');
        }}
        title={taskAction?.action === 'approve' ? 'Согласовать задачу' : 'Отклонить задачу'}
        description={taskAction ? `Договор: ${taskAction.task.contract_title || taskAction.task.contract}` : ''}
        size="md"
      >
        <div className="space-y-5">
          <Field label="Комментарий">
            <Textarea value={taskComment} onChange={(event) => setTaskComment(event.target.value)} placeholder="Кратко зафиксируйте решение или замечание." />
          </Field>
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => {
              setTaskAction(null);
              setTaskComment('');
            }}>
              Отмена
            </Button>
            <Button onClick={() => taskActionMutation.mutate()} busy={taskActionMutation.isPending} variant={taskAction?.action === 'reject' ? 'danger' : 'primary'}>
              {taskAction?.action === 'approve' ? 'Подтвердить согласование' : 'Подтвердить отклонение'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

