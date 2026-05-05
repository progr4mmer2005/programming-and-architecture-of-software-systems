from rest_framework import serializers
from .models import Estimate, EstimateVersion


class EstimateSerializer(serializers.ModelSerializer):
    contract_title = serializers.CharField(source='contract.title', read_only=True, default='')
    
    class Meta:
        model = Estimate
        fields = '__all__'
        read_only_fields = ['current_version', 'created_at', 'updated_at', 'organization', 'created_by']


class EstimateVersionSerializer(serializers.ModelSerializer):
    class Meta:
        model = EstimateVersion
        fields = '__all__'
        read_only_fields = ['created_at', 'estimate']


class EstimateUploadSerializer(serializers.Serializer):
    file = serializers.FileField()
    changelog = serializers.CharField(required=False, allow_blank=True)
    amount = serializers.DecimalField(max_digits=15, decimal_places=2, required=False)