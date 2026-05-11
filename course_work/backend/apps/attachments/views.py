"""Views for universal file attachments."""
from rest_framework import filters, permissions, viewsets
from django_filters.rest_framework import DjangoFilterBackend

from apps.core.mixins import OrganizationContextMixin
from apps.core.permissions import CanManageContracts, CanViewContracts

from .models import FileAttachment
from .serializers import FileAttachmentSerializer


class FileAttachmentViewSet(OrganizationContextMixin, viewsets.ModelViewSet):
    serializer_class = FileAttachmentSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['entity_type', 'entity_id', 'category']
    search_fields = ['file_name']
    ordering_fields = ['uploaded_at', 'size']

    def get_permissions(self):
        if self.action in ['list', 'retrieve']:
            permission_classes = [permissions.IsAuthenticated, CanViewContracts]
        else:
            permission_classes = [permissions.IsAuthenticated, CanManageContracts]
        return [permission() for permission in permission_classes]

    def get_queryset(self):
        return FileAttachment.objects.filter(organization=self.request.organization).select_related('uploaded_by')

    def perform_create(self, serializer):
        uploaded_file = self.request.FILES.get('file')
        serializer.save(
            organization=self.request.organization,
            uploaded_by=self.request.user,
            file_name=getattr(uploaded_file, 'name', ''),
            mime_type=getattr(uploaded_file, 'content_type', ''),
            size=getattr(uploaded_file, 'size', 0) or 0,
        )
