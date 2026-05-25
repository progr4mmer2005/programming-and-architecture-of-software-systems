from __future__ import annotations

from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.accounts.models import OrganizationMembership, OrganizationRole
from apps.accounts.serializers import UserSerializer
from apps.core.mixins import OrganizationContextMixin
from apps.core.permissions import CanManageOrganization
from apps.references.models import bootstrap_reference_entries

from .models import Organization
from .serializers import OrganizationDetailSerializer, OrganizationSerializer


class OrganizationViewSet(OrganizationContextMixin, viewsets.ModelViewSet):
    """Organization management with multi-org memberships."""

    serializer_class = OrganizationSerializer

    def get_permissions(self):
        if self.action in ['create', 'list', 'stats']:
            permission_classes = [permissions.IsAuthenticated]
        elif self.action in ['retrieve']:
            permission_classes = [permissions.IsAuthenticated]
        else:
            permission_classes = [permissions.IsAuthenticated, CanManageOrganization]
        return [permission() for permission in permission_classes]

    def get_queryset(self):
        return Organization.objects.filter(memberships__user=self.request.user, memberships__is_active=True).distinct()

    def get_serializer_class(self):
        if self.action == 'retrieve':
            return OrganizationDetailSerializer
        return OrganizationSerializer

    def perform_create(self, serializer):
        org = serializer.save()
        bootstrap_reference_entries(org)

        super_admin_role = OrganizationRole.create_default_super_admin(org)
        OrganizationRole.create_default_user(org)

        membership, _ = OrganizationMembership.objects.get_or_create(
            user=self.request.user,
            organization=org,
            defaults={'role': super_admin_role, 'is_active': True},
        )
        membership.role = super_admin_role
        membership.is_active = True
        membership.save(update_fields=['role', 'is_active', 'updated_at'])

        self.request.user.sync_context_from_membership(membership, save=True)

    def retrieve(self, request, *args, **kwargs):
        organization = self.get_object()
        data = self.get_serializer(organization).data
        data['members_count'] = organization.memberships.filter(is_active=True).count()
        data['contracts_count'] = organization.contracts.count()
        return Response(data)

    @action(detail=True, methods=['get'])
    def members(self, request, pk=None):
        organization = self.get_object()
        members = (
            self.request.user.__class__.objects.filter(memberships__organization=organization, memberships__is_active=True)
            .distinct()
        )
        page = self.paginate_queryset(members)
        serializer = UserSerializer(page, many=True)
        return self.get_paginated_response(serializer.data)

    @action(detail=False, methods=['get'])
    def stats(self, request):
        org = request.organization
        if org is None:
            return Response({'members_count': 0, 'contracts_count': 0, 'contractors_count': 0})
        data = {
            'members_count': org.memberships.filter(is_active=True).count(),
            'contracts_count': org.contracts.count(),
            'contractors_count': org.contractor_links.filter(is_active=True).count(),
        }
        return Response(data)
