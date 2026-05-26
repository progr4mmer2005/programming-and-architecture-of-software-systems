import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { GitBranchPlus, ShieldCheck, Workflow } from 'lucide-react';
import apiClient from '@/api/client';
import { useAuthStore } from '@/stores/authStore';
import { buildStagePreview, formatDate, getResults, summarizeStages } from '@/shared/lib/format';
import type {
  ApprovalRoute,
  ApprovalTask,
  PaginatedResponse,
} from '@/shared/types/domain';
import { approvalStatusOptions, roleLabels, roleOptions } from '@/shared/types/domain';
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
type TaskScope = 'mine' | 'all';

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
  const [taskScope, setTaskScope] = useState<TaskScope>(canProcessTasks ? 'mine' : 'all');
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
  const visibleTasks = tasks.filter((task) => {
    if (taskScope !== 'mine') {
      return true;
    }
    return Boolean(user?.id && task.assigned_to === user.id);
  });
  const canActOnTask = (task: ApprovalTask) => Boolean(
    canProcessTasks
    && task.status === 'pending'
    && user?.id
    && task.assigned_to
    && task.assigned_to === user.id,
  );


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
      await queryClient.invalidateQueries({ queryKey: ['approval-tasks'] });
      await queryClient.invalidateQueries({ queryKey: ['contracts'] });
      await queryClient.invalidateQueries({ queryKey: ['dashboard'] });
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
      />

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard label="Задачи" value={visibleTasks.length} hint={`${visibleTasks.filter((item) => item.status === 'pending').length} ожидают решения`} tone="brand" icon={<ShieldCheck className="h-5 w-5" />} />
        <StatCard label="Маршруты" value={routes.length} hint={`${routes.filter((item) => item.is_active).length} активных`} tone="accent" icon={<GitBranchPlus className="h-5 w-5" />} />
        <StatCard label="Этапы" value={routes.reduce((sum, item) => sum + (item.stages?.length ?? 0), 0)} hint="Суммарный состав маршрутов" tone="neutral" icon={<Workflow className="h-5 w-5" />} />
      </div>

      <Tabs
        value={tab}
        onChange={(value) => setTab(value as PageTab)}
        items={[
          { value: 'tasks', label: 'Задачи', badge: <Badge tone="accent">{visibleTasks.length}</Badge> },
          ...(canManageRoutes ? [{ value: 'routes', label: 'Маршруты', badge: <Badge tone="neutral">{routes.length}</Badge> }] : []),
        ]}
      />

      {tab === 'tasks' ? (
        <SectionCard title="Задачи согласования" description="Здесь доступны фильтрация задач и принятие решений по текущим этапам маршрутов.">
          <div className="mb-4 grid gap-4 md:grid-cols-[0.7fr_0.8fr_1.1fr]">
            <Field label="Статус">
              <Select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                <option value="">Все статусы</option>
                {approvalStatusOptions.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </Select>
            </Field>
            <Field label="Показать">
              <Select value={taskScope} onChange={(event) => setTaskScope(event.target.value as TaskScope)}>
                <option value="mine">Мои задачи</option>
                <option value="all">Все задачи</option>
              </Select>
            </Field>
          </div>

          {visibleTasks.length ? (
            <div className="space-y-3">
              {visibleTasks.map((task) => (
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
                        {task.assigned_to_name || 'Исполнитель не назначен'} • Роль: {roleLabels[task.role] || task.role}
                      </p>
                      <p className="mt-3 text-sm leading-7 text-[var(--muted-foreground)]">
                        {task.comment || 'Комментарий к задаче пока не добавлен.'}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-3">
                      {canActOnTask(task) ? (
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
                      ) : task.status === 'pending' && !task.assigned_to ? (
                        <p className="text-xs text-[var(--muted-foreground)]">
                          Для этого этапа пока не назначен ответственный согласующий.
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
            <EmptyState title={taskScope === 'mine' ? 'У Вас пока нет назначенных задач' : 'Задач не найдено'} description={taskScope === 'mine' ? 'Как только на Вас будет назначен этап согласования, он появится в этом списке.' : 'По текущему фильтру задачи не найдены. Измените параметры отбора или создайте маршрут согласования.'} />
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
                  onClick={() => {}}
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
            <EmptyState title="Маршрутов пока нет" description="Создайте маршрут в разделе «Организация»." />
          )}
        </SectionCard>
      ) : null}

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
