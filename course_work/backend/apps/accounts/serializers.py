from __future__ import annotations

from django.contrib.auth import get_user_model
from rest_framework import serializers

from apps.organizations.models import Organization

from .models import OrganizationInvitation, OrganizationMembership, OrganizationRole, build_permission_map

User = get_user_model()


class OrganizationRoleSerializer(serializers.ModelSerializer):
    class Meta:
        model = OrganizationRole
        fields = ['id', 'name', 'code', 'permissions', 'is_system', 'created_at', 'updated_at']
        read_only_fields = ['is_system', 'created_at', 'updated_at']


class OrganizationMembershipSerializer(serializers.ModelSerializer):
    role = OrganizationRoleSerializer(read_only=True)
    organization_name = serializers.CharField(source='organization.name', read_only=True)

    class Meta:
        model = OrganizationMembership
        fields = ['id', 'organization', 'organization_name', 'role', 'is_active', 'created_at']


class UserSerializer(serializers.ModelSerializer):
    full_name = serializers.SerializerMethodField()
    org_role = serializers.SerializerMethodField()
    org_role_id = serializers.SerializerMethodField()
    org_role_name = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            'id',
            'username',
            'email',
            'first_name',
            'last_name',
            'patronymic',
            'full_name',
            'role',
            'organization',
            'org_role',
            'org_role_id',
            'org_role_name',
            'phone',
            'position',
            'avatar',
            'is_active',
            'date_joined',
        ]
        read_only_fields = ['date_joined']

    def get_full_name(self, obj):
        return obj.get_full_name()

    def _get_membership(self, obj):
        request = self.context.get('request')
        organization = getattr(request, 'organization', None) if request else None
        if organization is None:
            return None
        return obj.memberships.select_related('role').filter(organization=organization, is_active=True).first()

    def get_org_role(self, obj):
        membership = self._get_membership(obj)
        return membership.role.code if membership else obj.role

    def get_org_role_id(self, obj):
        membership = self._get_membership(obj)
        return membership.role_id if membership else None

    def get_org_role_name(self, obj):
        membership = self._get_membership(obj)
        return membership.role.name if membership else obj.role


class UserRegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8)

    class Meta:
        model = User
        fields = ['username', 'email', 'password', 'first_name', 'last_name', 'patronymic', 'phone', 'position']

    def create(self, validated_data):
        password = validated_data.pop('password')
        user = User(**validated_data)
        user.set_password(password)
        user.organization = None
        user.role = User.Role.USER
        user.save()
        return user


class UserCreateSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8)

    class Meta:
        model = User
        fields = ['username', 'email', 'password', 'first_name', 'last_name', 'patronymic', 'phone', 'position']

    def create(self, validated_data):
        password = validated_data.pop('password')
        user = User(**validated_data)
        user.set_password(password)
        user.organization = None
        user.role = User.Role.USER
        user.save()
        return user


class ChangeRoleSerializer(serializers.Serializer):
    role_id = serializers.IntegerField()


class SwitchOrganizationSerializer(serializers.Serializer):
    organization_id = serializers.IntegerField()


class InvitationCreateSerializer(serializers.Serializer):
    email = serializers.EmailField()
    role_id = serializers.IntegerField(required=False)
    message = serializers.CharField(required=False, allow_blank=True)

    def validate(self, attrs):
        request = self.context['request']
        organization = request.organization
        if organization is None:
            raise serializers.ValidationError('Активная организация не выбрана.')

        role_id = attrs.get('role_id')
        if role_id:
            try:
                role = OrganizationRole.objects.get(id=role_id, organization=organization)
            except OrganizationRole.DoesNotExist as exc:
                raise serializers.ValidationError({'role_id': 'Роль не найдена в текущей организации.'}) from exc
            if role.code == User.Role.SUPER_ADMIN:
                raise serializers.ValidationError({'role_id': 'Нельзя приглашать пользователя сразу с ролью "Главный админ".'})
        else:
            role = OrganizationRole.create_default_user(organization)

        attrs['role'] = role
        attrs['email'] = attrs['email'].lower()
        return attrs

    def create(self, validated_data):
        request = self.context['request']
        organization = request.organization
        email = validated_data['email']
        role = validated_data['role']
        invited_user = User.objects.filter(email__iexact=email).first()

        invitation = OrganizationInvitation.objects.create(
            organization=organization,
            email=email,
            role=role,
            invited_by=request.user,
            invited_user=invited_user,
            message=validated_data.get('message', ''),
        )
        return invitation


class InvitationSerializer(serializers.ModelSerializer):
    organization_name = serializers.CharField(source='organization.name', read_only=True)
    role_name = serializers.CharField(source='role.name', read_only=True)
    invited_by_name = serializers.SerializerMethodField()

    class Meta:
        model = OrganizationInvitation
        fields = [
            'id',
            'organization',
            'organization_name',
            'email',
            'role',
            'role_name',
            'invited_by',
            'invited_by_name',
            'status',
            'message',
            'responded_at',
            'created_at',
            'updated_at',
        ]

    def get_invited_by_name(self, obj):
        if not obj.invited_by:
            return ''
        return obj.invited_by.get_full_name() or obj.invited_by.username


class InvitationDecisionSerializer(serializers.Serializer):
    decision = serializers.ChoiceField(choices=['accept', 'decline'])


class PermissionMatrixSerializer(serializers.Serializer):
    permissions = serializers.DictField(child=serializers.BooleanField())

    def validate_permissions(self, value):
        normalized = build_permission_map(False)
        for key in normalized:
            normalized[key] = bool(value.get(key, False))
        return normalized


class OrganizationBriefSerializer(serializers.ModelSerializer):
    role = serializers.CharField(source='role.code')
    role_name = serializers.CharField(source='role.name')

    class Meta:
        model = OrganizationMembership
        fields = ['organization', 'role', 'role_name', 'is_active']


class OrganizationCreateWithOwnerSerializer(serializers.ModelSerializer):
    class Meta:
        model = Organization
        fields = ['name', 'legal_name', 'inn', 'kpp', 'ogrn', 'address', 'logo', 'is_active']
