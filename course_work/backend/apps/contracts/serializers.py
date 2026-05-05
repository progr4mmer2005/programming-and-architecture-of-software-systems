from rest_framework import serializers
from .models import Contract, ContractVersion


class ContractListSerializer(serializers.ModelSerializer):
    contractor_name = serializers.CharField(source='contractor.name', read_only=True, default='')
    status_display = serializers.CharField(source='get_status_display', read_only=True)

    class Meta:
        model = Contract
        fields = ['id', 'title', 'number', 'status', 'status_display', 'contract_type',
                  'contractor', 'contractor_name', 'amount', 'currency',
                  'start_date', 'end_date', 'current_version', 'created_at']
        read_only_fields = ['current_version', 'created_at', 'updated_at', 'organization']


class ContractDetailSerializer(serializers.ModelSerializer):
    contractor_name = serializers.CharField(source='contractor.name', read_only=True, default='')
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    contract_type_display = serializers.CharField(source='get_contract_type_display', read_only=True)
    created_by_name = serializers.CharField(source='created_by.get_full_name', read_only=True, default='')
    versions_count = serializers.IntegerField(source='versions.count', read_only=True, default=0)

    class Meta:
        model = Contract
        fields = '__all__'
        read_only_fields = ['current_version', 'created_at', 'updated_at', 'organization', 'created_by']


class ContractVersionSerializer(serializers.ModelSerializer):
    created_by_name = serializers.CharField(source='created_by.get_full_name', read_only=True, default='')

    class Meta:
        model = ContractVersion
        fields = '__all__'
        read_only_fields = ['created_at', 'contract']


class ContractStatusChangeSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=Contract.Status.choices)
    comment = serializers.CharField(required=False, allow_blank=True)