from rest_framework import viewsets, permissions, filters
from django_filters.rest_framework import DjangoFilterBackend
from .models import AuditLog
from .serializers import AuditLogSerializer
from apps.core.mixins import OrganizationContextMixin
from apps.core.permissions import CanViewAudit, scope_audit_queryset


class AuditLogViewSet(OrganizationContextMixin, viewsets.ReadOnlyModelViewSet):
    """Read-only view of audit logs."""
    serializer_class = AuditLogSerializer
    permission_classes = [permissions.IsAuthenticated, CanViewAudit]
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['entity_type', 'entity_id', 'action', 'user']
    ordering = ['-created_at']

    def get_queryset(self):
        queryset = AuditLog.objects.filter(organization=self.request.organization)
        return scope_audit_queryset(queryset, self.request.user)
