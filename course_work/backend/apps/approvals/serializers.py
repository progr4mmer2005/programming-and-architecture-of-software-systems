from rest_framework import serializers
from .models import ApprovalRoute, ApprovalTask


class ApprovalRouteSerializer(serializers.ModelSerializer):
    class Meta:
        model = ApprovalRoute
        fields = '__all__'
        read_only_fields = ['created_at', 'updated_at', 'organization', 'created_by']


class ApprovalTaskSerializer(serializers.ModelSerializer):
    contract_title = serializers.CharField(source='contract.title', read_only=True, default='')
    route_name = serializers.CharField(source='route.name', read_only=True, default='')
    assigned_to_name = serializers.CharField(source='assigned_to.get_full_name', read_only=True, default='')
    status_display = serializers.CharField(source='get_status_display', read_only=True)

    class Meta:
        model = ApprovalTask
        fields = '__all__'
        read_only_fields = ['assigned_at', 'completed_at']


class ApprovalActionSerializer(serializers.Serializer):
    comment = serializers.CharField(required=False, allow_blank=True)
