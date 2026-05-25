import { useMemo, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';

import apiClient from '@/api/client';
import { useAuthStore } from '@/stores/authStore';
import { Badge, Button, EmptyState, PageIntro, SectionCard } from '@/shared/components/ui';

export default function WorkspacePage() {
  const navigate = useNavigate();
  const { user, organizations, invitations, fetchUser, switchOrganization, refreshInvitations } = useAuthStore();
  const [error, setError] = useState('');

  const hasOrganization = useMemo(() => organizations.length > 0, [organizations.length]);

  const openOrganization = useMutation({
    mutationFn: async (organizationId: number) => {
      await switchOrganization(organizationId);
    },
    onSuccess: () => navigate('/'),
    onError: () => setError('Не удалось переключиться на выбранную организацию.'),
  });

  const decideInvitation = useMutation({
    mutationFn: ({ invitationId, decision }: { invitationId: number; decision: 'accept' | 'decline' }) =>
      apiClient.post(`/invitations/${invitationId}/decide/`, { decision }),
    onSuccess: async () => {
      await refreshInvitations();
      await fetchUser();
    },
    onError: () => setError('Не удалось обработать приглашение.'),
  });

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="Workspace"
        title="Мои организации"
        actions={<Button onClick={() => navigate('/workspace/create')}>Создать организацию</Button>}
      />

      {error ? (
        <div className="rounded-2xl border border-[rgba(180,79,64,0.18)] bg-[rgba(180,79,64,0.08)] px-4 py-3 text-sm text-[var(--danger)]">
          {error}
        </div>
      ) : null}

      <SectionCard title="Организации" action={<Badge tone="brand">{organizations.length}</Badge>}>
        {hasOrganization ? (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {organizations.map((membership) => {
              const isActive = membership.organization === user?.organization;
              return (
                <div key={membership.id} className="rounded-2xl border border-[var(--line)] bg-white/80 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-[var(--foreground)]">{membership.organization_name || `Организация #${membership.organization}`}</p>
                      <p className="mt-1 text-xs text-[var(--muted-foreground)]">Роль: {membership.role.name}</p>
                    </div>
                    {isActive ? <Badge tone="success">Текущая</Badge> : null}
                  </div>

                  <Button
                    className="mt-4 w-full"
                    variant={isActive ? 'secondary' : 'primary'}
                    busy={openOrganization.isPending}
                    onClick={() => openOrganization.mutate(membership.organization)}
                  >
                    {isActive ? 'Открыть текущую' : 'Войти в эту организацию'}
                  </Button>
                </div>
              );
            })}
          </div>
        ) : (
          <EmptyState
            title="Вы пока не состоите ни в одной организации"
            description="Создайте новую организацию или примите приглашение от коллег."
            action={<Button onClick={() => navigate('/workspace/create')}>Создать организацию</Button>}
          />
        )}
      </SectionCard>

      <SectionCard title="Приглашения" action={<Badge tone="accent">{invitations.length}</Badge>}>
        {invitations.length ? (
          <div className="space-y-3">
            {invitations.map((invitation) => (
              <div key={invitation.id} className="rounded-2xl border border-[var(--line)] bg-white/80 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-[var(--foreground)]">{invitation.organization_name}</p>
                    <p className="text-xs text-[var(--muted-foreground)]">Роль: {invitation.role_name || invitation.role}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="secondary"
                      busy={decideInvitation.isPending}
                      onClick={() => decideInvitation.mutate({ invitationId: invitation.id, decision: 'decline' })}
                    >
                      Отклонить
                    </Button>
                    <Button
                      busy={decideInvitation.isPending}
                      onClick={() => decideInvitation.mutate({ invitationId: invitation.id, decision: 'accept' })}
                    >
                      Принять
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState title="Новых приглашений нет" />
        )}
      </SectionCard>
    </div>
  );
}
