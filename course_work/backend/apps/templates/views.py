from rest_framework import filters, permissions, viewsets
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser

from apps.core.mixins import OrganizationContextMixin
from apps.core.permissions import CanManageTemplates, CanViewTemplates

from .models import ContractTemplate
from .serializers import ContractTemplateSerializer


class ContractTemplateViewSet(OrganizationContextMixin, viewsets.ModelViewSet):
    """CRUD for stored contract templates."""

    serializer_class = ContractTemplateSerializer
    filter_backends = [filters.SearchFilter]
    search_fields = ['name', 'description']
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_permissions(self):
        if self.action in ['list', 'retrieve']:
            permission_classes = [permissions.IsAuthenticated, CanViewTemplates]
        else:
            permission_classes = [permissions.IsAuthenticated, CanManageTemplates]
        return [permission() for permission in permission_classes]

    def get_queryset(self):
        return ContractTemplate.objects.filter(organization=self.request.organization)

    def perform_create(self, serializer):
        serializer.save(
            organization=self.request.organization,
            created_by=self.request.user,
        )
