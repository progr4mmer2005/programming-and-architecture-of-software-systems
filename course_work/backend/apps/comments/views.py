from rest_framework import viewsets, permissions, filters
from django_filters.rest_framework import DjangoFilterBackend
from .models import Comment
from .serializers import CommentSerializer
from apps.core.mixins import OrganizationContextMixin
from apps.core.permissions import CanViewContracts, scope_related_to_contract_queryset


class CommentViewSet(OrganizationContextMixin, viewsets.ModelViewSet):
    """CRUD for comments on contracts."""
    serializer_class = CommentSerializer
    permission_classes = [permissions.IsAuthenticated, CanViewContracts]
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['contract', 'is_internal']
    ordering = ['-created_at']

    def get_queryset(self):
        queryset = Comment.objects.filter(organization=self.request.organization)
        return scope_related_to_contract_queryset(queryset, self.request.user)

    def perform_create(self, serializer):
        serializer.save(
            organization=self.request.organization,
            author=self.request.user,
        )
