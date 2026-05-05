from rest_framework import viewsets, permissions, filters
from .models import ContractTemplate
from .serializers import ContractTemplateSerializer


class ContractTemplateViewSet(viewsets.ModelViewSet):
    """CRUD for contract templates."""
    serializer_class = ContractTemplateSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [filters.SearchFilter]
    search_fields = ['name', 'description']

    def get_queryset(self):
        return ContractTemplate.objects.filter(
            organization=self.request.organization, is_active=True
        )

    def perform_create(self, serializer):
        serializer.save(
            organization=self.request.organization,
            created_by=self.request.user,
        )