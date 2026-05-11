from rest_framework import serializers

from .models import Act


class ActSerializer(serializers.ModelSerializer):
    contract_title = serializers.CharField(source='contract.title', read_only=True, default='')
    stage_name = serializers.CharField(source='stage.name', read_only=True, default='')
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    created_by_name = serializers.CharField(source='created_by.get_full_name', read_only=True, default='')

    class Meta:
        model = Act
        fields = '__all__'
        read_only_fields = ['created_by', 'created_at', 'updated_at']

    def validate(self, attrs):
        contract = attrs.get('contract') or getattr(self.instance, 'contract', None)
        stage = attrs.get('stage') or getattr(self.instance, 'stage', None)
        if stage and contract and stage.contract_id != contract.id:
            raise serializers.ValidationError({'stage': 'Этап должен относиться к выбранному договору.'})
        amount = attrs.get('amount')
        if amount is not None and amount < 0:
            raise serializers.ValidationError({'amount': 'Сумма акта не может быть отрицательной.'})
        return attrs
