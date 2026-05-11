from rest_framework import serializers
from .models import ReferenceEntry


class ReferenceEntrySerializer(serializers.ModelSerializer):
    category_display = serializers.CharField(source='get_category_display', read_only=True)

    class Meta:
        model = ReferenceEntry
        fields = '__all__'
        read_only_fields = ['organization', 'created_at', 'updated_at']

