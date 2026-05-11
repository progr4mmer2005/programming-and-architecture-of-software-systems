from rest_framework import serializers

from .models import Contract, ContractAttachment, ContractVersion


class ContractListSerializer(serializers.ModelSerializer):
    contractor_name = serializers.CharField(source='contractor.name', read_only=True, default='')
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    price_type_display = serializers.CharField(source='get_price_type_display', read_only=True)

    class Meta:
        model = Contract
        fields = [
            'id', 'title', 'number', 'status', 'status_display', 'contractor', 'contractor_name',
            'amount', 'currency', 'price_type', 'price_type_display', 'start_date', 'end_date',
            'signing_date', 'termination_date', 'current_version', 'created_at', 'updated_at',
        ]
        read_only_fields = ['current_version', 'created_at', 'updated_at', 'organization']


class ContractDetailSerializer(serializers.ModelSerializer):
    contractor_name = serializers.CharField(source='contractor.name', read_only=True, default='')
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    price_type_display = serializers.CharField(source='get_price_type_display', read_only=True)
    created_by_name = serializers.CharField(source='created_by.get_full_name', read_only=True, default='')
    versions_count = serializers.IntegerField(source='versions.count', read_only=True, default=0)

    class Meta:
        model = Contract
        fields = '__all__'
        read_only_fields = ['current_version', 'created_at', 'updated_at', 'organization', 'created_by']

    def validate_contractor(self, value):
        request = self.context.get('request')
        current_org = getattr(request, 'organization', None)
        if value is None or current_org is None:
            return value
        if not value.organization_links.filter(organization=current_org, is_active=True).exists():
            raise serializers.ValidationError('Выбранный контрагент не привязан к Вашей организации.')
        return value

    def validate(self, attrs):
        price_type = attrs.get('price_type', getattr(self.instance, 'price_type', Contract.PriceType.NOT_SPECIFIED))
        amount = attrs.get('amount', getattr(self.instance, 'amount', None))
        currency = attrs.get('currency', getattr(self.instance, 'currency', None))
        if price_type == Contract.PriceType.NOT_SPECIFIED and amount is not None:
            raise serializers.ValidationError({'amount': 'Для стоимости “не указана” сумма должна быть пустой.'})
        if amount is not None and price_type != Contract.PriceType.FREE and not currency:
            raise serializers.ValidationError({'currency': 'Валюта обязательна, если указана сумма.'})
        if amount is not None and amount < 0:
            raise serializers.ValidationError({'amount': 'Сумма договора не может быть отрицательной.'})
        return attrs


class ContractVersionSerializer(serializers.ModelSerializer):
    created_by_name = serializers.CharField(source='created_by.get_full_name', read_only=True, default='')

    class Meta:
        model = ContractVersion
        fields = '__all__'
        read_only_fields = ['contract', 'version_number', 'snapshot', 'change_reason', 'created_by', 'created_at', 'is_current']


class ContractStatusChangeSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=Contract.Status.choices)
    comment = serializers.CharField(required=False, allow_blank=True)


class ContractAttachmentSerializer(serializers.ModelSerializer):
    uploaded_by_name = serializers.CharField(source='uploaded_by.get_full_name', read_only=True, default='')
    contract_title = serializers.CharField(source='contract.title', read_only=True, default='')
    document_type_display = serializers.CharField(source='get_document_type_display', read_only=True)

    class Meta:
        model = ContractAttachment
        fields = '__all__'
        read_only_fields = ['uploaded_by', 'created_at']
