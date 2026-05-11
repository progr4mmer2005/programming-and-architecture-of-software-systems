from rest_framework import permissions, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import filters
from .models import ReferenceEntry, bootstrap_reference_entries
from .serializers import ReferenceEntrySerializer
from apps.core.mixins import OrganizationContextMixin
from apps.core.permissions import CanManageReferences


class ReferenceEntryViewSet(OrganizationContextMixin, viewsets.ModelViewSet):
    serializer_class = ReferenceEntrySerializer
    permission_classes = [permissions.IsAuthenticated, CanManageReferences]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_fields = ['category', 'is_active']
    search_fields = ['code', 'label', 'description']

    def get_queryset(self):
        bootstrap_reference_entries(self.request.organization)
        return ReferenceEntry.objects.filter(organization=self.request.organization)

    def perform_create(self, serializer):
        serializer.save(organization=self.request.organization)

    @action(detail=False, methods=['post'])
    def bootstrap(self, request):
        bootstrap_reference_entries(request.organization)
        return Response({'status': 'ok'})
