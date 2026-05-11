from django.db.models import Prefetch, Q
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import filters, permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.organizations.models import Organization
from apps.organizations.serializers import OrganizationSerializer
from apps.core.mixins import OrganizationContextMixin
from apps.core.permissions import CanManageContractors, CanViewContractors

from .models import Contractor, OrganizationContractor
from .serializers import (
    ContractorSerializer,
    LinkExistingContractorSerializer,
    LinkOrganizationSerializer,
)


class ContractorViewSet(OrganizationContextMixin, viewsets.ModelViewSet):
    """Global contractor directory with per-organization links."""

    serializer_class = ContractorSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['name', 'full_name', 'inn', 'ogrn', 'email', 'contact_person', 'linked_organization__name']
    filterset_fields = ['is_active', 'linked_organization']
    ordering_fields = ['name', 'created_at', 'updated_at']

    def get_permissions(self):
        if self.action in ['list', 'retrieve', 'directory', 'internal_organizations']:
            permission_classes = [permissions.IsAuthenticated, CanViewContractors]
        else:
            permission_classes = [permissions.IsAuthenticated, CanManageContractors]
        return [permission() for permission in permission_classes]

    def _base_queryset(self):
        return Contractor.objects.select_related('organization', 'linked_organization').prefetch_related(
            Prefetch('organization_links', queryset=OrganizationContractor.objects.select_related('organization')),
        )

    def get_queryset(self):
        if self.action == 'directory':
            return self._base_queryset().distinct()
        return self._base_queryset().filter(
            organization_links__organization=self.request.organization,
            organization_links__is_active=True,
        ).distinct()

    def perform_create(self, serializer):
        contractor = serializer.save(organization=self.request.organization)
        OrganizationContractor.objects.get_or_create(
            organization=self.request.organization,
            contractor=contractor,
            defaults={'is_active': True},
        )

    def perform_destroy(self, instance):
        current_org = self.request.organization
        has_org_contracts = instance.contracts.filter(organization=current_org).exists()
        if has_org_contracts:
            raise ValueError('Нельзя удалить связь с контрагентом, пока он используется в договорах Вашей организации.')

        OrganizationContractor.objects.filter(organization=current_org, contractor=instance).delete()
        if not instance.organization_links.exists() and not instance.contracts.exists():
            instance.delete()

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        try:
            self.perform_destroy(instance)
        except ValueError as error:
            return Response({'detail': str(error)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=False, methods=['get'])
    def directory(self, request):
        queryset = self.filter_queryset(self._base_queryset()).distinct()
        page = self.paginate_queryset(queryset)
        serializer = self.get_serializer(page or queryset, many=True)
        if page is not None:
            return self.get_paginated_response(serializer.data)
        return Response(serializer.data)

    @action(detail=False, methods=['post'])
    def link_existing(self, request):
        serializer = LinkExistingContractorSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        contractor = Contractor.objects.filter(id=serializer.validated_data['contractor_id']).first()
        if contractor is None:
            return Response({'detail': 'Контрагент не найден'}, status=status.HTTP_404_NOT_FOUND)

        OrganizationContractor.objects.get_or_create(
            organization=request.organization,
            contractor=contractor,
            defaults={
                'is_active': True,
                'notes': serializer.validated_data.get('notes', ''),
            },
        )
        return Response(self.get_serializer(contractor).data)

    @action(detail=False, methods=['post'])
    def link_organization(self, request):
        serializer = LinkOrganizationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        linked_org = Organization.objects.get(id=serializer.validated_data['organization_id'])

        contractor = Contractor.objects.filter(
            Q(linked_organization=linked_org) | Q(inn=linked_org.inn),
        ).first()
        if contractor is None:
            contractor = Contractor.objects.create(
                organization=request.organization,
                linked_organization=linked_org,
                name=linked_org.name,
                full_name=linked_org.legal_name or linked_org.name,
                inn=linked_org.inn,
                kpp=linked_org.kpp,
                ogrn=linked_org.ogrn,
                address=linked_org.address,
                is_active=linked_org.is_active,
            )
        elif contractor.linked_organization_id is None:
            contractor.linked_organization = linked_org
            contractor.save(update_fields=['linked_organization'])

        OrganizationContractor.objects.get_or_create(
            organization=request.organization,
            contractor=contractor,
            defaults={
                'is_active': True,
                'notes': serializer.validated_data.get('notes', ''),
            },
        )
        return Response(self.get_serializer(contractor).data, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['get'])
    def internal_organizations(self, request):
        search = request.query_params.get('search', '').strip()
        queryset = Organization.objects.exclude(id=request.organization.id).filter(is_active=True)
        if search:
            queryset = queryset.filter(
                Q(name__icontains=search)
                | Q(legal_name__icontains=search)
                | Q(inn__icontains=search)
            )
        queryset = queryset.order_by('name')[:30]
        return Response(OrganizationSerializer(queryset, many=True).data)
