from rest_framework import viewsets, status, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db.models import Count
from .models import Organization
from .serializers import OrganizationSerializer, OrganizationDetailSerializer
from apps.accounts.models import User
from apps.accounts.serializers import UserSerializer, ChangeRoleSerializer, UserCreateSerializer
from apps.core.permissions import IsOwnerOrAdmin
from apps.core.mixins import OrganizationContextMixin
from apps.references.models import bootstrap_reference_entries


class OrganizationViewSet(OrganizationContextMixin, viewsets.ModelViewSet):
    """Organization management (Owner only)."""
    serializer_class = OrganizationSerializer
    permission_classes = [permissions.IsAuthenticated, IsOwnerOrAdmin]

    def get_queryset(self):
        return Organization.objects.filter(id=self.request.organization.id)

    def get_serializer_class(self):
        if self.action == 'retrieve':
            return OrganizationDetailSerializer
        return OrganizationSerializer

    def perform_create(self, serializer):
        org = serializer.save()
        bootstrap_reference_entries(org)
        # Set the creating user as owner
        self.request.user.organization = org
        self.request.user.role = User.Role.OWNER
        self.request.user.save()

    @action(detail=True, methods=['get'])
    def members(self, request, pk=None):
        """List all members of the organization."""
        org = self.get_object()
        members = User.objects.filter(organization=org)
        page = self.paginate_queryset(members)
        serializer = UserSerializer(page, many=True)
        return self.get_paginated_response(serializer.data)

    @action(detail=True, methods=['post'])
    def change_role(self, request, pk=None):
        """Change a user's role (Owner/Admin only)."""
        org = self.get_object()
        serializer = ChangeRoleSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            user = User.objects.get(id=request.data.get('user_id'), organization=org)
            user.role = serializer.validated_data['role']
            user.save()
            return Response({'status': 'role changed'})
        except User.DoesNotExist:
            return Response({'error': 'User not found'}, status=status.HTTP_404_NOT_FOUND)

    @action(detail=True, methods=['post'])
    def invite(self, request, pk=None):
        """Invite a new user to the organization."""
        org = self.get_object()
        serializer = UserCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save(organization=org)
        return Response(UserSerializer(user).data, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['get'])
    def stats(self, request):
        """Get organization statistics."""
        org = request.organization
        data = {
            'members_count': User.objects.filter(organization=org).count(),
            'contracts_count': org.contracts.count(),
            'contractors_count': org.contractor_links.filter(is_active=True).count(),
        }
        return Response(data)
