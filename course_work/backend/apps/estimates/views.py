from rest_framework import viewsets, status, permissions, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from .models import Estimate, EstimateVersion
from .serializers import EstimateSerializer, EstimateVersionSerializer, EstimateUploadSerializer


class EstimateViewSet(viewsets.ModelViewSet):
    """CRUD for estimates with versioning support."""
    serializer_class = EstimateSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    search_fields = ['title', 'number']
    filterset_fields = ['status', 'contract']

    def get_queryset(self):
        return Estimate.objects.filter(organization=self.request.organization)

    def perform_create(self, serializer):
        serializer.save(organization=self.request.organization, created_by=self.request.user)

    @action(detail=True, methods=['get'])
    def versions(self, request, pk=None):
        estimate = self.get_object()
        versions = estimate.versions.all()
        page = self.paginate_queryset(versions)
        serializer = EstimateVersionSerializer(page, many=True)
        return self.get_paginated_response(serializer.data)

    @action(detail=True, methods=['post'])
    def upload_version(self, request, pk=None):
        estimate = self.get_object()
        serializer = EstimateUploadSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        new_v = estimate.current_version + 1
        version = EstimateVersion.objects.create(
            estimate=estimate,
            version_number=new_v,
            amount=serializer.validated_data.get('amount', estimate.amount),
            file=serializer.validated_data.get('file'),
            changelog=serializer.validated_data.get('changelog', ''),
            created_by=request.user,
            is_current=True,
        )
        estimate.versions.exclude(id=version.id).update(is_current=False)
        estimate.current_version = new_v
        estimate.save()
        return Response(EstimateVersionSerializer(version).data, status=status.HTTP_201_CREATED)