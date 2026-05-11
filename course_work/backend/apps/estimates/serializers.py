from django.utils import timezone
from rest_framework import serializers

from .models import Estimate, EstimateItem, EstimateVersion


class EstimateItemSerializer(serializers.ModelSerializer):
    stage_name = serializers.CharField(source='stage.name', read_only=True, default='')

    class Meta:
        model = EstimateItem
        fields = '__all__'
        read_only_fields = ['total']

    def validate(self, attrs):
        estimate = attrs.get('estimate', getattr(self.instance, 'estimate', None))
        stage = attrs.get('stage', getattr(self.instance, 'stage', None))
        if stage and estimate and stage.contract_id != estimate.contract_id:
            raise serializers.ValidationError({'stage': 'Этап должен относиться к договору сметы.'})
        quantity = attrs.get('quantity', getattr(self.instance, 'quantity', None))
        price = attrs.get('price', getattr(self.instance, 'price', None))
        if quantity is not None and quantity <= 0:
            raise serializers.ValidationError({'quantity': 'Количество должно быть больше 0.'})
        if price is not None and price < 0:
            raise serializers.ValidationError({'price': 'Цена не может быть отрицательной.'})
        return attrs


class EstimateSerializer(serializers.ModelSerializer):
    contract_title = serializers.CharField(source='contract.title', read_only=True, default='')
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    items = EstimateItemSerializer(many=True, read_only=True)
    items_count = serializers.IntegerField(source='items.count', read_only=True, default=0)
    amount = serializers.DecimalField(source='total_amount', max_digits=15, decimal_places=2, read_only=True)

    class Meta:
        model = Estimate
        fields = '__all__'
        read_only_fields = ['total_amount', 'amount', 'current_version', 'created_at', 'updated_at', 'organization', 'created_by', 'approved_at']

    def validate(self, attrs):
        contract = attrs.get('contract', getattr(self.instance, 'contract', None))
        request = self.context.get('request')
        if contract and request and contract.organization_id != getattr(request.organization, 'id', None):
            raise serializers.ValidationError({'contract': 'Договор должен относиться к Вашей организации.'})
        return attrs

    def update(self, instance, validated_data):
        old_status = instance.status
        instance = super().update(instance, validated_data)
        if old_status != Estimate.Status.APPROVED and instance.status == Estimate.Status.APPROVED and instance.approved_at is None:
            instance.approved_at = timezone.now()
            instance.save(update_fields=['approved_at', 'updated_at'])
        return instance


class EstimateVersionSerializer(serializers.ModelSerializer):
    created_by_name = serializers.CharField(source='created_by.get_full_name', read_only=True, default='')

    class Meta:
        model = EstimateVersion
        fields = '__all__'
        read_only_fields = ['estimate', 'version_number', 'snapshot', 'change_reason', 'created_by', 'created_at', 'is_current']
