from copy import deepcopy

from django.shortcuts import get_object_or_404
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import filters, permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.attachments.models import FileAttachment
from apps.attachments.serializers import FileAttachmentSerializer
from apps.core.mixins import OrganizationContextMixin
from apps.core.permissions import CanManageEstimates, CanViewEstimates, scope_related_to_contract_queryset

from .models import Estimate, EstimateItem, EstimateVersion
from .serializers import EstimateItemSerializer, EstimateSerializer, EstimateVersionSerializer
from .services import create_estimate_version, estimate_snapshot, hasImportantEstimateChanges


class EstimateViewSet(OrganizationContextMixin, viewsets.ModelViewSet):
    serializer_class = EstimateSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    search_fields = ['title', 'number', 'contract__title', 'contract__number']
    filterset_fields = ['status', 'contract']

    def get_permissions(self):
        if self.action in ['list', 'retrieve', 'versions', 'files']:
            permission_classes = [permissions.IsAuthenticated, CanViewEstimates]
        else:
            permission_classes = [permissions.IsAuthenticated, CanManageEstimates]
        return [permission() for permission in permission_classes]

    def get_queryset(self):
        queryset = Estimate.objects.filter(organization=self.request.organization).select_related('contract', 'created_by').prefetch_related('items')
        return scope_related_to_contract_queryset(queryset, self.request.user)

    def perform_create(self, serializer):
        estimate = serializer.save(organization=self.request.organization, created_by=self.request.user)
        create_estimate_version(estimate, self.request.user, 'Создание сметы')

    def perform_update(self, serializer):
        old_snapshot = estimate_snapshot(self.get_object())
        estimate = serializer.save()
        new_snapshot = estimate_snapshot(estimate)
        if hasImportantEstimateChanges(old_snapshot, new_snapshot):
            create_estimate_version(estimate, self.request.user, 'Изменение данных сметы')

    @action(detail=True, methods=['get'])
    def versions(self, request, pk=None):
        estimate = self.get_object()
        page = self.paginate_queryset(estimate.versions.all())
        serializer = EstimateVersionSerializer(page, many=True)
        return self.get_paginated_response(serializer.data)

    @action(detail=True, methods=['get'])
    def files(self, request, pk=None):
        estimate = self.get_object()
        files = FileAttachment.objects.filter(organization=request.organization, entity_type='estimate', entity_id=estimate.id)
        page = self.paginate_queryset(files)
        serializer = FileAttachmentSerializer(page, many=True)
        return self.get_paginated_response(serializer.data)

    @action(detail=True, methods=['post'])
    def upload_file(self, request, pk=None):
        estimate = self.get_object()
        uploaded_file = request.FILES.get('file')
        if not uploaded_file:
            return Response({'file': 'Файл обязателен.'}, status=status.HTTP_400_BAD_REQUEST)
        attachment = FileAttachment.objects.create(
            organization=request.organization,
            entity_type=FileAttachment.EntityType.ESTIMATE,
            entity_id=estimate.id,
            category=request.data.get('category') or FileAttachment.Category.SOURCE,
            file=uploaded_file,
            file_name=uploaded_file.name,
            mime_type=getattr(uploaded_file, 'content_type', ''),
            size=getattr(uploaded_file, 'size', 0) or 0,
            uploaded_by=request.user,
        )
        return Response(FileAttachmentSerializer(attachment).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'])
    def restore_version(self, request, pk=None):
        estimate = self.get_object()
        version = get_object_or_404(EstimateVersion, id=request.data.get('version_id'), estimate=estimate)
        snapshot = version.snapshot or {}
        estimate.title = snapshot.get('title', estimate.title)
        estimate.number = snapshot.get('number', estimate.number)
        estimate.status = snapshot.get('status', estimate.status)
        estimate.currency = snapshot.get('currency', estimate.currency)
        estimate.save()
        estimate.items.all().delete()
        for item in snapshot.get('items', []):
            EstimateItem.objects.create(
                estimate=estimate,
                stage_id=item.get('stageId'),
                name=item.get('name') or '',
                description=item.get('description') or '',
                unit=item.get('unit') or '',
                quantity=item.get('quantity') or 1,
                price=item.get('price') or 0,
                sort_order=item.get('sortOrder') or 0,
            )
        restored = create_estimate_version(estimate, request.user, f'Восстановление версии {version.version_number}')
        return Response(EstimateVersionSerializer(restored).data, status=status.HTTP_201_CREATED)


class EstimateItemViewSet(OrganizationContextMixin, viewsets.ModelViewSet):
    serializer_class = EstimateItemSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['estimate', 'stage']
    search_fields = ['name', 'description']
    ordering_fields = ['sort_order', 'total', 'price', 'quantity']

    def get_permissions(self):
        if self.action in ['list', 'retrieve']:
            permission_classes = [permissions.IsAuthenticated, CanViewEstimates]
        else:
            permission_classes = [permissions.IsAuthenticated, CanManageEstimates]
        return [permission() for permission in permission_classes]

    def get_queryset(self):
        queryset = EstimateItem.objects.filter(estimate__organization=self.request.organization).select_related('estimate', 'stage')
        return scope_related_to_contract_queryset(queryset, self.request.user, relation='estimate__contract')

    def perform_create(self, serializer):
        item = serializer.save()
        create_estimate_version(item.estimate, self.request.user, 'Добавление позиции сметы')

    def perform_update(self, serializer):
        old_snapshot = estimate_snapshot(serializer.instance.estimate)
        item = serializer.save()
        new_snapshot = estimate_snapshot(item.estimate)
        if hasImportantEstimateChanges(old_snapshot, new_snapshot):
            create_estimate_version(item.estimate, self.request.user, 'Изменение позиции сметы')

    def perform_destroy(self, instance):
        estimate = instance.estimate
        old_snapshot = estimate_snapshot(estimate)
        instance.delete()
        new_snapshot = estimate_snapshot(estimate)
        if hasImportantEstimateChanges(old_snapshot, new_snapshot):
            create_estimate_version(estimate, self.request.user, 'Удаление позиции сметы')
