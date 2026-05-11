from rest_framework import serializers

from apps.organizations.models import Organization

from .models import Contractor, OrganizationContractor


class ContractorSerializer(serializers.ModelSerializer):
    linked_organization_name = serializers.CharField(source='linked_organization.name', read_only=True, default='')
    source_organization_name = serializers.CharField(source='organization.name', read_only=True, default='')
    linked_organizations_count = serializers.SerializerMethodField()
    is_linked_to_current_organization = serializers.SerializerMethodField()

    class Meta:
        model = Contractor
        fields = '__all__'
        read_only_fields = [
            'created_at',
            'updated_at',
            'organization',
            'source_organization_name',
            'linked_organization_name',
            'linked_organizations_count',
            'is_linked_to_current_organization',
        ]

    def validate_inn(self, value):
        if not value.isdigit() or len(value) not in (10, 12):
            raise serializers.ValidationError('ИНН должен содержать 10 или 12 цифр')
        return value

    def get_linked_organizations_count(self, obj):
        return obj.organization_links.count()

    def get_is_linked_to_current_organization(self, obj):
        request = self.context.get('request')
        current_org = getattr(request, 'organization', None)
        if not current_org:
            return False
        return obj.organization_links.filter(organization=current_org, is_active=True).exists()

    def create(self, validated_data):
        source_org = validated_data.pop('organization', None)
        linked_organization = validated_data.get('linked_organization')
        inn = validated_data.get('inn')

        contractor = None
        if linked_organization is not None:
            contractor = Contractor.objects.filter(linked_organization=linked_organization).first()
            if contractor is None:
                contractor = Contractor.objects.filter(inn=linked_organization.inn).first()
            validated_data.setdefault('name', linked_organization.name)
            validated_data.setdefault('full_name', linked_organization.legal_name or linked_organization.name)
            validated_data.setdefault('inn', linked_organization.inn)
            validated_data.setdefault('kpp', linked_organization.kpp)
            validated_data.setdefault('ogrn', linked_organization.ogrn)
            validated_data.setdefault('address', linked_organization.address)

        if contractor is None and inn:
            contractor = Contractor.objects.filter(inn=inn).first()

        if contractor is None:
            return Contractor.objects.create(organization=source_org, **validated_data)

        changed_fields = []
        if source_org and contractor.organization_id is None:
            contractor.organization = source_org
            changed_fields.append('organization')
        if linked_organization and contractor.linked_organization_id is None:
            contractor.linked_organization = linked_organization
            changed_fields.append('linked_organization')

        for field, value in validated_data.items():
            current_value = getattr(contractor, field, None)
            if value and current_value in (None, ''):
                setattr(contractor, field, value)
                changed_fields.append(field)

        if changed_fields:
            contractor.save(update_fields=sorted(set(changed_fields)))
        return contractor


class OrganizationContractorSerializer(serializers.ModelSerializer):
    contractor_name = serializers.CharField(source='contractor.name', read_only=True)

    class Meta:
        model = OrganizationContractor
        fields = '__all__'
        read_only_fields = ['created_at', 'updated_at']


class LinkExistingContractorSerializer(serializers.Serializer):
    contractor_id = serializers.IntegerField()
    notes = serializers.CharField(required=False, allow_blank=True)


class LinkOrganizationSerializer(serializers.Serializer):
    organization_id = serializers.IntegerField()
    notes = serializers.CharField(required=False, allow_blank=True)

    def validate_organization_id(self, value):
        if not Organization.objects.filter(id=value, is_active=True).exists():
            raise serializers.ValidationError('Организация не найдена')
        return value
