from rest_framework import serializers

from .models import Payment, PaymentCalendar


class PaymentSerializer(serializers.ModelSerializer):
    contract_title = serializers.CharField(source='contract.title', read_only=True, default='')
    stage_name = serializers.CharField(source='stage.name', read_only=True, default='')
    act_title = serializers.CharField(source='act.title', read_only=True, default='')
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    type_display = serializers.CharField(source='get_type_display', read_only=True)
    actual_date = serializers.DateField(source='paid_date', read_only=True)

    class Meta:
        model = Payment
        fields = '__all__'
        read_only_fields = ['created_at', 'updated_at', 'created_by', 'actual_date']

    def validate(self, attrs):
        contract = attrs.get('contract', getattr(self.instance, 'contract', None))
        stage = attrs.get('stage', getattr(self.instance, 'stage', None))
        act = attrs.get('act', getattr(self.instance, 'act', None))
        payment_type = attrs.get('type', getattr(self.instance, 'type', None))
        status = attrs.get('status', getattr(self.instance, 'status', None))
        planned_date = attrs.get('planned_date', getattr(self.instance, 'planned_date', None))
        paid_date = attrs.get('paid_date', getattr(self.instance, 'paid_date', None))
        amount = attrs.get('amount', getattr(self.instance, 'amount', None))
        if stage and contract and stage.contract_id != contract.id:
            raise serializers.ValidationError({'stage': 'Этап должен относиться к выбранному договору.'})
        if act and contract and act.contract_id != contract.id:
            raise serializers.ValidationError({'act': 'Акт должен относиться к выбранному договору.'})
        if payment_type == Payment.Type.PLANNED and not planned_date:
            raise serializers.ValidationError({'planned_date': 'Для планового платежа нужна плановая дата.'})
        if status == Payment.Status.PAID and not paid_date:
            raise serializers.ValidationError({'paid_date': 'Для оплаченного платежа нужна дата оплаты.'})
        if amount is not None and amount < 0:
            raise serializers.ValidationError({'amount': 'Сумма платежа не может быть отрицательной.'})
        return attrs


class PaymentCalendarSerializer(serializers.ModelSerializer):
    class Meta:
        model = PaymentCalendar
        fields = '__all__'
        read_only_fields = ['updated_at']
