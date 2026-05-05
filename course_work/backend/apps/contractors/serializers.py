from rest_framework import serializers
from .models import Contractor


class ContractorSerializer(serializers.ModelSerializer):
    class Meta:
        model = Contractor
        fields = '__all__'
        read_only_fields = ['created_at', 'updated_at', 'organization']

    def validate_inn(self, value):
        if not value.isdigit() or len(value) not in (10, 12):
            raise serializers.ValidationError('ИНН должен содержать 10 или 12 цифр')
        return value