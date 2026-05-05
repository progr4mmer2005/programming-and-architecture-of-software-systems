from rest_framework import serializers
from .models import ContractStage


class ContractStageSerializer(serializers.ModelSerializer):
    class Meta:
        model = ContractStage
        fields = '__all__'
        read_only_fields = ['created_at', 'updated_at']