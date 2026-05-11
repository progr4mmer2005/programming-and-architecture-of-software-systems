"""Serializers for universal file attachments."""
from rest_framework import serializers

from .models import FileAttachment


class FileAttachmentSerializer(serializers.ModelSerializer):
    uploaded_by_name = serializers.CharField(source='uploaded_by.get_full_name', read_only=True, default='')
    category_display = serializers.CharField(source='get_category_display', read_only=True)
    entity_type_display = serializers.CharField(source='get_entity_type_display', read_only=True)
    file_url = serializers.CharField(read_only=True)

    class Meta:
        model = FileAttachment
        fields = '__all__'
        read_only_fields = ['organization', 'uploaded_by', 'uploaded_at', 'file_name', 'mime_type', 'size']
