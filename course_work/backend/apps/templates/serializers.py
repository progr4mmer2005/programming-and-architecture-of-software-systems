from rest_framework import serializers
from .models import ContractTemplate


class ContractTemplateSerializer(serializers.ModelSerializer):
    class Meta:
        model = ContractTemplate
        fields = '__all__'
        read_only_fields = ['created_at', 'updated_at', 'organization', 'created_by']