from rest_framework import viewsets, status, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from django.contrib.auth import get_user_model
from .models import User
from .serializers import UserSerializer, UserCreateSerializer, ChangeRoleSerializer
from apps.core.permissions import get_role_permissions

User = get_user_model()


class UserViewSet(viewsets.ModelViewSet):
    """User management."""
    serializer_class = UserSerializer

    def get_queryset(self):
        if self.request.user.is_authenticated and self.request.organization:
            return User.objects.filter(organization=self.request.organization)
        return User.objects.none()

    def get_serializer_class(self):
        if self.action == 'create':
            return UserCreateSerializer
        return UserSerializer

    def perform_create(self, serializer):
        serializer.save(organization=self.request.organization)

    @action(detail=False, methods=['get', 'put', 'patch'])
    def me(self, request):
        """Get/update current user profile."""
        if request.method == 'GET':
            return Response(UserSerializer(request.user).data)
        serializer = UserSerializer(request.user, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    def change_role(self, request, pk=None):
        """Change user role (Owner/Admin only)."""
        user = self.get_object()
        if request.user.role not in [User.Role.OWNER, User.Role.ADMIN]:
            return Response({'error': 'Permission denied'}, status=status.HTTP_403_FORBIDDEN)
        serializer = ChangeRoleSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user.role = serializer.validated_data['role']
        user.save()
        return Response(UserSerializer(user).data)

    @action(detail=False, methods=['get'])
    def permissions(self, request):
        """Get current user's permissions."""
        if not request.user.is_authenticated:
            return Response({'error': 'Not authenticated'}, status=status.HTTP_401_UNAUTHORIZED)
        perms = get_role_permissions(request.user.role)
        return Response({
            'role': request.user.role,
            'permissions': perms,
        })