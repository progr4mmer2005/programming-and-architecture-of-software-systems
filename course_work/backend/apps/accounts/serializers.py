from rest_framework import serializers
from .models import User


class UserSerializer(serializers.ModelSerializer):
    full_name = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'first_name', 'last_name', 'patronymic',
                  'full_name', 'role', 'organization', 'phone', 'position', 'avatar',
                  'is_active', 'date_joined']
        read_only_fields = ['date_joined']

    def get_full_name(self, obj):
        return obj.get_full_name()


class UserCreateSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8)

    class Meta:
        model = User
        fields = ['username', 'email', 'password', 'first_name', 'last_name',
                  'patronymic', 'role', 'phone', 'position']

    def create(self, validated_data):
        password = validated_data.pop('password')
        user = User(**validated_data)
        user.set_password(password)
        user.save()
        return user


class ChangeRoleSerializer(serializers.Serializer):
    role = serializers.ChoiceField(choices=User.Role.choices)


class LoginSerializer(serializers.Serializer):
    username = serializers.CharField()
    password = serializers.CharField()