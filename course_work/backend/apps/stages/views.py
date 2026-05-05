from rest_framework import viewsets, permissions, filters
from .models import ContractStage
from .serializers import ContractStageSerializer


class ContractStageViewSet(viewsets.ModelViewSet):
    """CRUD for contract stages/milestones."""
    serializer_class = ContractStageSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [filters.OrderingFilter]
    ordering = ['order']

    def get_queryset(self):
        return ContractStage.objects.filter(contract__organization=self.request.organization)

    def perform_create(self, serializer):
        serializer.save()