from rest_framework import viewsets, status, permissions, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from django.shortcuts import get_object_or_404
from .models import Contract, ContractVersion
from .serializers import (
    ContractListSerializer, ContractDetailSerializer,
    ContractVersionSerializer, ContractStatusChangeSerializer,
)
from apps.audit.models import AuditLog


class ContractViewSet(viewsets.ModelViewSet):
    """Full contract lifecycle management."""
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['title', 'number', 'description']
    filterset_fields = ['status', 'contract_type', 'contractor', 'responsible']
    ordering_fields = ['created_at', 'updated_at', 'amount', 'start_date', 'end_date']

    def get_serializer_class(self):
        if self.action == 'list':
            return ContractListSerializer
        return ContractDetailSerializer

    def get_queryset(self):
        return Contract.objects.filter(organization=self.request.organization)\
            .select_related('contractor', 'created_by', 'responsible')

    def perform_create(self, serializer):
        serializer.save(organization=self.request.organization, created_by=self.request.user)

    @action(detail=True, methods=['post'])
    def change_status(self, request, pk=None):
        """Change contract status and create audit log."""
        contract = self.get_object()
        serializer = ContractStatusChangeSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        old_status = contract.status
        new_status = serializer.validated_data['status']
        contract.status = new_status
        contract.save()
        AuditLog.objects.create(
            organization=request.organization,
            user=request.user,
            action='status_change',
            entity_type='contract',
            entity_id=contract.id,
            changes={'old_status': old_status, 'new_status': new_status},
            description=serializer.validated_data.get('comment', ''),
        )
        return Response({'status': 'changed', 'new_status': new_status})

    @action(detail=True, methods=['get'])
    def versions(self, request, pk=None):
        """Get all versions of a contract."""
        contract = self.get_object()
        versions = contract.versions.all()
        page = self.paginate_queryset(versions)
        serializer = ContractVersionSerializer(page, many=True)
        return self.get_paginated_response(serializer.data)

    @action(detail=True, methods=['post'])
    def new_version(self, request, pk=None):
        """Create a new version of the contract."""
        contract = self.get_object()
        new_v = contract.current_version + 1
        version = ContractVersion.objects.create(
            contract=contract,
            version_number=new_v,
            number=contract.number,
            amount=contract.amount,
            content=request.data.get('content', {}),
            changelog=request.data.get('changelog', ''),
            created_by=request.user,
            is_current=True,
        )
        # Set previous versions as not current
        contract.versions.exclude(id=version.id).update(is_current=False)
        contract.current_version = new_v
        contract.save()
        return Response(ContractVersionSerializer(version).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'])
    def restore_version(self, request, pk=None):
        """Restore a specific version of the contract."""
        contract = self.get_object()
        version_id = request.data.get('version_id')
        version = get_object_or_404(ContractVersion, id=version_id, contract=contract)
        new_v = contract.current_version + 1
        new_version = ContractVersion.objects.create(
            contract=contract,
            version_number=new_v,
            number=version.number,
            amount=version.amount,
            content=version.content,
            changelog=f'Restored from version {version.version_number}',
            created_by=request.user,
            is_current=True,
        )
        contract.versions.exclude(id=new_version.id).update(is_current=False)
        contract.current_version = new_v
        contract.number = version.number
        contract.amount = version.amount
        contract.save()
        return Response(ContractVersionSerializer(new_version).data, status=status.HTTP_201_CREATED)


class ContractVersionViewSet(viewsets.ReadOnlyModelViewSet):
    """View contract versions."""
    serializer_class = ContractVersionSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return ContractVersion.objects.filter(contract__organization=self.request.organization)