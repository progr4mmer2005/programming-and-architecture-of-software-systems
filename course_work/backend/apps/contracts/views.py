from copy import copy

from django.shortcuts import get_object_or_404
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import filters, permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.accounts.models import OrganizationMembership
from apps.approvals.models import ApprovalRoute, ApprovalTask
from apps.approvals.serializers import ApprovalTaskSerializer
from apps.attachments.models import FileAttachment
from apps.attachments.serializers import FileAttachmentSerializer
from apps.audit.models import AuditLog
from apps.core.mixins import OrganizationContextMixin
from apps.core.permissions import (
    CanLaunchApproval,
    CanManageContracts,
    CanViewContracts,
    role_has_permission,
    scope_contract_queryset,
    scope_related_to_contract_queryset,
)

from .models import Contract, ContractAttachment, ContractVersion
from .serializers import (
    ContractAttachmentSerializer,
    ContractDetailSerializer,
    ContractListSerializer,
    ContractStatusChangeSerializer,
    ContractVersionSerializer,
)
from .services import create_contract_version, hasImportantContractChanges


class ContractViewSet(OrganizationContextMixin, viewsets.ModelViewSet):
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['title', 'number', 'description', 'contractor__name', 'contractor__inn']
    filterset_fields = ['status', 'contractor', 'responsible', 'currency', 'price_type']
    ordering_fields = ['created_at', 'updated_at', 'amount', 'start_date', 'end_date']

    def get_permissions(self):
        if self.action in ['list', 'retrieve', 'versions', 'files']:
            permission_classes = [permissions.IsAuthenticated, CanViewContracts]
        elif self.action in ['change_status', 'launch_approval']:
            permission_classes = [permissions.IsAuthenticated, CanLaunchApproval]
        else:
            permission_classes = [permissions.IsAuthenticated, CanManageContracts]
        return [permission() for permission in permission_classes]

    def get_serializer_class(self):
        if self.action == 'list':
            return ContractListSerializer
        return ContractDetailSerializer

    def get_queryset(self):
        queryset = Contract.objects.filter(organization=self.request.organization).select_related('contractor', 'created_by', 'responsible')
        return scope_contract_queryset(queryset, self.request.user)

    def perform_create(self, serializer):
        contract = serializer.save(organization=self.request.organization, created_by=self.request.user)
        create_contract_version(contract, self.request.user, 'Создание договора')

    def perform_update(self, serializer):
        old_contract = copy(self.get_object())
        contract = serializer.save()
        if hasImportantContractChanges(old_contract, contract):
            create_contract_version(contract, self.request.user, 'Изменение данных договора')

    def _resolve_route(self, route_id=None):
        routes = ApprovalRoute.objects.filter(organization=self.request.organization, is_active=True).order_by('name')
        if route_id:
            return get_object_or_404(routes, id=route_id)
        return routes.first()

    @action(detail=True, methods=['post'])
    def change_status(self, request, pk=None):
        contract = self.get_object()
        serializer = ContractStatusChangeSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        old_contract = copy(contract)
        old_status = contract.status
        new_status = serializer.validated_data['status']
        contract.status = new_status
        contract.save(update_fields=['status', 'updated_at'])
        if hasImportantContractChanges(old_contract, contract):
            create_contract_version(contract, request.user, serializer.validated_data.get('comment', 'Изменение статуса'))
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

    @action(detail=True, methods=['post'])
    def launch_approval(self, request, pk=None):
        contract = self.get_object()
        if not role_has_permission(request.user, 'can_launch_approval'):
            return Response({'error': 'Недостаточно прав для запуска согласования.'}, status=status.HTTP_403_FORBIDDEN)
        active_tasks = ApprovalTask.objects.filter(contract=contract, status__in=[ApprovalTask.Status.PENDING, ApprovalTask.Status.WAITING])
        if active_tasks.exists():
            return Response({'error': 'По договору уже запущен активный маршрут согласования.'}, status=status.HTTP_400_BAD_REQUEST)
        route = self._resolve_route(request.data.get('route_id'))
        if route is None:
            return Response({'error': 'Для договора не найден активный маршрут согласования.'}, status=status.HTTP_400_BAD_REQUEST)
        stages = sorted(route.stages or [], key=lambda item: (int(item.get('order', 0) or 0), str(item.get('name', ''))))
        if not stages:
            return Response({'error': 'У выбранного маршрута не настроены этапы.'}, status=status.HTTP_400_BAD_REQUEST)
        first_stage_order = int(stages[0].get('order', 1) or 1)
        created_tasks = []
        for stage in stages:
            stage_order = int(stage.get('order', first_stage_order) or first_stage_order)
            role = str(stage.get('role', '')).strip()
            assignee_id = stage.get('assigned_to')
            if assignee_id in [None, '']:
                return Response({'error': f'Для этапа "{stage.get("name") or stage_order}" не задан ответственный согласующий.'}, status=status.HTTP_400_BAD_REQUEST)
            assignee_membership = OrganizationMembership.objects.select_related('user', 'role').filter(
                organization=self.request.organization,
                user_id=assignee_id,
                user__is_active=True,
                is_active=True,
            ).first()
            if assignee_membership is None or assignee_membership.role.code != role:
                return Response({'error': f'Ответственный пользователь этапа "{stage.get("name") or stage_order}" не найден или не соответствует роли.'}, status=status.HTTP_400_BAD_REQUEST)
            assignee = assignee_membership.user
            created_tasks.append(ApprovalTask.objects.create(
                contract=contract,
                route=route,
                stage_order=stage_order,
                role=role,
                assigned_to=assignee,
                status=ApprovalTask.Status.PENDING if stage_order == first_stage_order else ApprovalTask.Status.WAITING,
                comment=f'Этап "{stage.get("name") or f"Шаг {stage_order}"}" маршрута "{route.name}" запущен автоматически.',
            ))
        old_contract = copy(contract)
        previous_status = contract.status
        if contract.status != Contract.Status.ON_APPROVAL:
            contract.status = Contract.Status.ON_APPROVAL
            contract.save(update_fields=['status', 'updated_at'])
            create_contract_version(contract, request.user, f'Запуск маршрута согласования "{route.name}"')
        AuditLog.objects.create(
            organization=request.organization,
            user=request.user,
            action='approval_started',
            entity_type='contract',
            entity_id=contract.id,
            changes={'route_id': route.id, 'route_name': route.name, 'tasks_created': len(created_tasks), 'old_status': previous_status, 'new_status': contract.status},
            description=f'Маршрут "{route.name}" запущен из карточки договора.',
        )
        return Response({
            'status': 'started',
            'route_id': route.id,
            'route_name': route.name,
            'tasks_created': len(created_tasks),
            'tasks': ApprovalTaskSerializer(created_tasks, many=True).data,
        }, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['get'])
    def versions(self, request, pk=None):
        contract = self.get_object()
        page = self.paginate_queryset(contract.versions.all())
        serializer = ContractVersionSerializer(page, many=True)
        return self.get_paginated_response(serializer.data)

    @action(detail=True, methods=['get'])
    def files(self, request, pk=None):
        contract = self.get_object()
        files = FileAttachment.objects.filter(organization=request.organization, entity_type='contract', entity_id=contract.id)
        page = self.paginate_queryset(files)
        serializer = FileAttachmentSerializer(page, many=True)
        return self.get_paginated_response(serializer.data)

    @action(detail=True, methods=['post'])
    def restore_version(self, request, pk=None):
        contract = self.get_object()
        version = get_object_or_404(ContractVersion, id=request.data.get('version_id'), contract=contract)
        snapshot = version.snapshot or {}
        field_map = {
            'number': 'number', 'title': 'title', 'description': 'description', 'contractorId': 'contractor_id',
            'amount': 'amount', 'currency': 'currency', 'priceType': 'price_type', 'status': 'status',
            'startDate': 'start_date', 'endDate': 'end_date', 'signingDate': 'signing_date',
            'terminationDate': 'termination_date', 'paymentTerms': 'payment_terms',
        }
        for key, field in field_map.items():
            if key in snapshot:
                setattr(contract, field, snapshot[key])
        contract.save()
        restored = create_contract_version(contract, request.user, f'Восстановление версии {version.version_number}')
        return Response(ContractVersionSerializer(restored).data, status=status.HTTP_201_CREATED)


class ContractVersionViewSet(OrganizationContextMixin, viewsets.ReadOnlyModelViewSet):
    serializer_class = ContractVersionSerializer
    permission_classes = [permissions.IsAuthenticated, CanViewContracts]

    def get_queryset(self):
        queryset = ContractVersion.objects.filter(contract__organization=self.request.organization)
        return scope_related_to_contract_queryset(queryset, self.request.user)


class ContractAttachmentViewSet(OrganizationContextMixin, viewsets.ModelViewSet):
    serializer_class = ContractAttachmentSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_fields = ['contract', 'document_type']
    search_fields = ['title', 'description']

    def get_permissions(self):
        if self.action in ['list', 'retrieve']:
            permission_classes = [permissions.IsAuthenticated, CanViewContracts]
        else:
            permission_classes = [permissions.IsAuthenticated, CanManageContracts]
        return [permission() for permission in permission_classes]

    def get_queryset(self):
        queryset = ContractAttachment.objects.filter(contract__organization=self.request.organization).select_related('contract', 'uploaded_by')
        return scope_related_to_contract_queryset(queryset, self.request.user)

    def perform_create(self, serializer):
        serializer.save(uploaded_by=self.request.user)
