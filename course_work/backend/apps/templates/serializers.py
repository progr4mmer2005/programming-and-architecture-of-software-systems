from pathlib import Path

from rest_framework import serializers

from .models import ContractTemplate


class ContractTemplateSerializer(serializers.ModelSerializer):
    document_name = serializers.SerializerMethodField()
    has_document = serializers.SerializerMethodField()

    class Meta:
        model = ContractTemplate
        fields = [
            'id',
            'organization',
            'name',
            'description',
            'document',
            'document_name',
            'has_document',
            'is_active',
            'created_by',
            'created_at',
            'updated_at',
        ]
        read_only_fields = [
            'created_at',
            'updated_at',
            'organization',
            'created_by',
            'document_name',
            'has_document',
        ]

    def get_document_name(self, obj: ContractTemplate) -> str:
        if not obj.document:
            return ''
        return Path(obj.document.name).name

    def get_has_document(self, obj: ContractTemplate) -> bool:
        return bool(obj.document)

