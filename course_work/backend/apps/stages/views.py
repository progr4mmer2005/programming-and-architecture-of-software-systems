from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import filters, permissions, viewsets

from apps.core.mixins import OrganizationContextMixin
from apps.core.permissions import CanManageContracts, CanViewContracts, scope_related_to_contract_queryset

from .models import ContractStage
from .serializers import ContractStageSerializer


class ContractStageViewSet(OrganizationContextMixin, viewsets.ModelViewSet):
    serializer_class = ContractStageSerializer
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter, filters.SearchFilter]
    filterset_fields = ['contract', 'status', 'responsible_user']
    search_fields = ['name', 'description', 'contract__title', 'contract__number']
    ordering = ['order']
    ordering_fields = ['order', 'start_date', 'end_date', 'planned_amount', 'actual_amount']

    def get_permissions(self):
        if self.action in ['list', 'retrieve']:
            permission_classes = [permissions.IsAuthenticated, CanViewContracts]
        else:
            permission_classes = [permissions.IsAuthenticated, CanManageContracts]
        return [permission() for permission in permission_classes]

    def get_queryset(self):
        queryset = ContractStage.objects.filter(contract__organization=self.request.organization).select_related('contract', 'responsible_user')
        return scope_related_to_contract_queryset(queryset, self.request.user)
