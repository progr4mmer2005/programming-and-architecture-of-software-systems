from rest_framework import viewsets, permissions, filters
from django_filters.rest_framework import DjangoFilterBackend
from .models import Contractor
from .serializers import ContractorSerializer


class ContractorViewSet(viewsets.ModelViewSet):
    """CRUD for contractors (counterparties)."""
    serializer_class = ContractorSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['name', 'inn', 'ogrn', 'email']
    filterset_fields = ['is_active']

    def get_queryset(self):
        return Contractor.objects.filter(organization=self.request.organization)

    def perform_create(self, serializer):
        serializer.save(organization=self.request.organization)