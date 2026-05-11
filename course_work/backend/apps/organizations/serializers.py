from rest_framework import serializers
from .models import Organization


class OrganizationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Organization
        fields = '__all__'
        read_only_fields = ['created_at', 'updated_at']


class OrganizationDetailSerializer(serializers.ModelSerializer):
    members_count = serializers.IntegerField(read_only=True, default=0)
    contracts_count = serializers.IntegerField(read_only=True, default=0)

    class Meta:
        model = Organization
        fields = '__all__'
        read_only_fields = ['created_at', 'updated_at']