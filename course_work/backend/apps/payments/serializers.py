from rest_framework import serializers
from .models import Payment, PaymentCalendar


class PaymentSerializer(serializers.ModelSerializer):
    contract_title = serializers.CharField(source='contract.title', read_only=True, default='')

    class Meta:
        model = Payment
        fields = '__all__'
        read_only_fields = ['created_at', 'updated_at', 'created_by']


class PaymentCalendarSerializer(serializers.ModelSerializer):
    class Meta:
        model = PaymentCalendar
        fields = '__all__'
        read_only_fields = ['updated_at']