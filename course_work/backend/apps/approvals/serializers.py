from rest_framework import serializers

from apps.accounts.models import OrganizationMembership, User

from .models import ApprovalRoute, ApprovalTask


class ApprovalRouteSerializer(serializers.ModelSerializer):
    def validate_stages(self, value):
        request = self.context.get('request')
        organization = getattr(request, 'organization', None) or getattr(self.instance, 'organization', None)
        if organization is None:
            raise serializers.ValidationError('Не удалось определить организацию для маршрута.')
        if not value:
            raise serializers.ValidationError('Добавьте хотя бы один этап маршрута.')

        normalized = []
        for index, stage in enumerate(value, start=1):
            role = str(stage.get('role') or '').strip()
            name = str(stage.get('name') or '').strip()
            order = int(stage.get('order') or index)
            assigned_to = stage.get('assigned_to')
            if assigned_to in [None, '']:
                raise serializers.ValidationError(f'Для этапа "{name or index}" выберите ответственного пользователя.')
            membership = OrganizationMembership.objects.select_related('user', 'role').filter(
                user_id=int(assigned_to),
                organization=organization,
                is_active=True,
                user__is_active=True,
            ).first()
            if membership is None:
                raise serializers.ValidationError(f'Ответственный пользователь для этапа "{name or index}" не найден.')
            normalized_role = role or (membership.role.code if membership.role else '')
            if role and membership.role.code != role:
                display_name = membership.user.get_full_name() or membership.user.username
                raise serializers.ValidationError(
                    f'Пользователь "{display_name}" не соответствует роли этапа "{name or index}".',
                )
            normalized.append({
                'name': name,
                'role': normalized_role,
                'order': order,
                'assigned_to': membership.user.id,
                'assigned_to_name': membership.user.get_full_name() or membership.user.username,
            })
        return normalized

    def to_representation(self, instance):
        data = super().to_representation(instance)
        stages = data.get('stages') or []
        user_ids = [
            int(stage['assigned_to'])
            for stage in stages
            if stage.get('assigned_to') not in [None, '']
        ]
        users = User.objects.filter(id__in=user_ids).only('id', 'first_name', 'last_name', 'username')
        user_names = {
            user.id: user.get_full_name() or user.username
            for user in users
        }
        for stage in stages:
            assigned_to = stage.get('assigned_to')
            if assigned_to not in [None, '']:
                stage['assigned_to_name'] = user_names.get(int(assigned_to), stage.get('assigned_to_name', ''))
        data['stages'] = stages
        return data

    class Meta:
        model = ApprovalRoute
        fields = '__all__'
        read_only_fields = ['created_at', 'updated_at', 'organization', 'created_by']


class ApprovalTaskSerializer(serializers.ModelSerializer):
    contract_title = serializers.CharField(source='contract.title', read_only=True, default='')
    route_name = serializers.CharField(source='route.name', read_only=True, default='')
    assigned_to_name = serializers.CharField(source='assigned_to.get_full_name', read_only=True, default='')
    status_display = serializers.CharField(source='get_status_display', read_only=True)

    class Meta:
        model = ApprovalTask
        fields = '__all__'
        read_only_fields = ['assigned_at', 'completed_at']


class ApprovalActionSerializer(serializers.Serializer):
    comment = serializers.CharField(required=False, allow_blank=True)
