from rest_framework import filters, permissions, viewsets
from django_filters.rest_framework import DjangoFilterBackend

from apps.core.mixins import OrganizationContextMixin
from apps.core.permissions import CanManageContracts, CanViewContracts, scope_related_to_contract_queryset

from .models import Act
from .serializers import ActSerializer


class ActViewSet(OrganizationContextMixin, viewsets.ModelViewSet):
    serializer_class = ActSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['contract', 'stage', 'status']
    search_fields = ['number', 'title', 'description', 'contract__title', 'contract__number']
    ordering_fields = ['date', 'amount', 'created_at']

    def get_permissions(self):
        if self.action in ['list', 'retrieve']:
            permission_classes = [permissions.IsAuthenticated, CanViewContracts]
        else:
            permission_classes = [permissions.IsAuthenticated, CanManageContracts]
        return [permission() for permission in permission_classes]

    def get_queryset(self):
        queryset = Act.objects.filter(contract__organization=self.request.organization).select_related('contract', 'stage', 'created_by')
        return scope_related_to_contract_queryset(queryset, self.request.user)

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)
