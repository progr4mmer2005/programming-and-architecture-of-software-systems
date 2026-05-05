from rest_framework import viewsets, status, permissions, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from django.shortcuts import get_object_or_404
from .models import ApprovalRoute, ApprovalTask
from .serializers import ApprovalRouteSerializer, ApprovalTaskSerializer, ApprovalActionSerializer
from apps.audit.models import AuditLog


class ApprovalRouteViewSet(viewsets.ModelViewSet):
    """Manage approval route templates."""
    serializer_class = ApprovalRouteSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return ApprovalRoute.objects.filter(organization=self.request.organization)

    def perform_create(self, serializer):
        serializer.save(organization=self.request.organization, created_by=self.request.user)


class ApprovalTaskViewSet(viewsets.ModelViewSet):
    """Manage approval tasks for contracts."""
    serializer_class = ApprovalTaskSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [filters.SearchFilter]
    search_fields = ['contract__title']
    filterset_fields = ['status', 'role', 'contract']

    def get_queryset(self):
        return ApprovalTask.objects.filter(contract__organization=self.request.organization)

    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        """Approve the current task."""
        task = self.get_object()
        if task.status != 'pending':
            return Response({'error': 'Task already processed'}, status=status.HTTP_400_BAD_REQUEST)
        serializer = ApprovalActionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        task.status = 'approved'
        task.comment = serializer.validated_data.get('comment', '')
        from django.utils import timezone
        task.completed_at = timezone.now()
        task.save()
        # Check if next stage should be activated
        self._activate_next_stage(task)
        return Response({'status': 'approved'})

    @action(detail=True, methods=['post'])
    def reject(self, request, pk=None):
        """Reject the current task."""
        task = self.get_object()
        if task.status != 'pending':
            return Response({'error': 'Task already processed'}, status=status.HTTP_400_BAD_REQUEST)
        serializer = ApprovalActionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        task.status = 'rejected'
        task.comment = serializer.validated_data.get('comment', '')
        from django.utils import timezone
        task.completed_at = timezone.now()
        task.save()
        return Response({'status': 'rejected'})

    def _activate_next_stage(self, task):
        """Activate the next approval stage if all current stage tasks are approved."""
        next_tasks = ApprovalTask.objects.filter(
            contract=task.contract,
            stage_order=task.stage_order + 1,
            status='pending',
        )
        # Check if all tasks at current stage are approved
        current_stage_tasks = ApprovalTask.objects.filter(
            contract=task.contract,
            stage_order=task.stage_order,
        )
        if all(t.status == 'approved' for t in current_stage_tasks):
            next_tasks.update(status='pending')