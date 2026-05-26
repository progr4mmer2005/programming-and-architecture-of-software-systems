from django.utils import timezone
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import filters, permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response

from apps.audit.models import AuditLog
from apps.contracts.models import Contract
from apps.core.mixins import OrganizationContextMixin
from apps.core.permissions import (
    CanManageApprovalRoutes,
    CanProcessApprovalTasks,
    CanViewApprovals,
    role_has_permission,
    scope_approval_tasks_queryset,
)

from .models import ApprovalRoute, ApprovalTask
from .serializers import ApprovalActionSerializer, ApprovalRouteSerializer, ApprovalTaskSerializer


class ApprovalRouteViewSet(OrganizationContextMixin, viewsets.ModelViewSet):
    """Manage approval route templates."""

    serializer_class = ApprovalRouteSerializer

    def get_permissions(self):
        if self.action in ['list', 'retrieve']:
            permission_classes = [permissions.IsAuthenticated, CanViewApprovals]
        else:
            permission_classes = [permissions.IsAuthenticated, CanManageApprovalRoutes]
        return [permission() for permission in permission_classes]

    def get_queryset(self):
        return ApprovalRoute.objects.filter(organization=self.request.organization)

    def perform_create(self, serializer):
        serializer.save(organization=self.request.organization, created_by=self.request.user)


class ApprovalTaskViewSet(OrganizationContextMixin, viewsets.ModelViewSet):
    """Manage approval tasks for contracts."""

    serializer_class = ApprovalTaskSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    search_fields = ['contract__title']
    filterset_fields = ['status', 'role', 'contract', 'deadline']

    def get_permissions(self):
        if self.action in ['approve', 'reject']:
            permission_classes = [permissions.IsAuthenticated, CanProcessApprovalTasks]
        elif self.action in ['list', 'retrieve', 'assign_deadline']:
            permission_classes = [permissions.IsAuthenticated, CanViewApprovals]
        else:
            permission_classes = [permissions.IsAuthenticated, CanManageApprovalRoutes]
        return [permission() for permission in permission_classes]

    def get_queryset(self):
        queryset = ApprovalTask.objects.filter(
            contract__organization=self.request.organization,
        ).select_related('contract', 'assigned_to', 'route')
        return scope_approval_tasks_queryset(queryset, self.request.user)

    def _ensure_task_is_mine(self, task):
        if task.assigned_to and task.assigned_to_id == self.request.user.id:
            return
        if task.assigned_to_id is None:
            raise PermissionDenied('По этой задаче не назначен ответственный согласующий.')
        raise PermissionDenied('Согласовать или отклонить задачу может только назначенный ответственный.')

    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        task = self.get_object()
        self._ensure_task_is_mine(task)
        if task.status != ApprovalTask.Status.PENDING:
            return Response({'error': 'Task already processed'}, status=status.HTTP_400_BAD_REQUEST)
        serializer = ApprovalActionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        task.status = ApprovalTask.Status.APPROVED
        task.comment = serializer.validated_data.get('comment', '')
        task.completed_at = timezone.now()
        task.save()
        self._activate_next_stage(task)
        return Response({'status': 'approved'})

    @action(detail=True, methods=['post'])
    def reject(self, request, pk=None):
        task = self.get_object()
        self._ensure_task_is_mine(task)
        if task.status != ApprovalTask.Status.PENDING:
            return Response({'error': 'Task already processed'}, status=status.HTTP_400_BAD_REQUEST)
        serializer = ApprovalActionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        task.status = ApprovalTask.Status.REJECTED
        task.comment = serializer.validated_data.get('comment', '')
        task.completed_at = timezone.now()
        task.save()
        if task.contract.status == Contract.Status.ON_APPROVAL:
            task.contract.status = Contract.Status.DRAFT
            task.contract.save(update_fields=['status', 'updated_at'])
        return Response({'status': 'rejected'})

    @action(detail=True, methods=['post'])
    def assign_deadline(self, request, pk=None):
        if not (role_has_permission(request.user, 'can_manage_approval_routes') or role_has_permission(request.user, 'can_manage_contracts')):
            raise PermissionDenied('Изменение сроков доступно только пользователям с правом управления согласованием.')
        task = self.get_object()
        task.deadline = request.data.get('deadline') or None
        task.save(update_fields=['deadline'])
        return Response(ApprovalTaskSerializer(task).data)

    def _activate_next_stage(self, task):
        current_stage_tasks = ApprovalTask.objects.filter(
            contract=task.contract,
            stage_order=task.stage_order,
        )
        if not all(current.status == ApprovalTask.Status.APPROVED for current in current_stage_tasks):
            return

        next_stage_order = ApprovalTask.objects.filter(
            contract=task.contract,
            status=ApprovalTask.Status.WAITING,
        ).order_by('stage_order').values_list('stage_order', flat=True).first()

        if next_stage_order is None:
            if task.contract.status != Contract.Status.READY_TO_SIGN:
                task.contract.status = Contract.Status.READY_TO_SIGN
                task.contract.save(update_fields=['status', 'updated_at'])
                AuditLog.objects.create(
                    organization=self.request.organization,
                    user=self.request.user,
                    action='approval_completed',
                    entity_type='contract',
                    entity_id=task.contract.id,
                    changes={'status': Contract.Status.READY_TO_SIGN},
                    description='Маршрут согласования завершён, договор переведён в статус "Готов к подписанию".',
                )
            return

        ApprovalTask.objects.filter(
            contract=task.contract,
            stage_order=next_stage_order,
            status=ApprovalTask.Status.WAITING,
        ).update(status=ApprovalTask.Status.PENDING)
