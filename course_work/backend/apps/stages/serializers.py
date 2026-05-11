from rest_framework import serializers

from apps.acts.models import Act
from apps.estimates.models import EstimateItem

from .models import ContractStage
from .services import calculateStageActualAmount, calculateStagePlannedAmount


class ContractStageSerializer(serializers.ModelSerializer):
    responsible_user_name = serializers.CharField(source='responsible_user.get_full_name', read_only=True, default='')
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    calculated_planned_amount = serializers.SerializerMethodField()
    calculated_actual_amount = serializers.SerializerMethodField()
    is_completed = serializers.BooleanField(read_only=True)
    amount = serializers.DecimalField(source='planned_amount', max_digits=15, decimal_places=2, required=False, allow_null=True)

    class Meta:
        model = ContractStage
        fields = '__all__'
        read_only_fields = ['created_at', 'updated_at']

    def get_calculated_planned_amount(self, obj):
        items = EstimateItem.objects.filter(estimate__contract=obj.contract, stage=obj)
        value = calculateStagePlannedAmount(obj, items)
        return str(value) if value is not None else None

    def get_calculated_actual_amount(self, obj):
        value = calculateStageActualAmount(obj, Act.objects.filter(stage=obj))
        return str(value)

    def validate(self, attrs):
        planned = attrs.get('planned_amount', getattr(self.instance, 'planned_amount', None))
        actual = attrs.get('actual_amount', getattr(self.instance, 'actual_amount', None))
        if planned is not None and planned < 0:
            raise serializers.ValidationError({'planned_amount': 'Плановая сумма не может быть отрицательной.'})
        if actual is not None and actual < 0:
            raise serializers.ValidationError({'actual_amount': 'Фактическая сумма не может быть отрицательной.'})
        return attrs
