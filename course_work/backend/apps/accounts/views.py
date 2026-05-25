from __future__ import annotations

from django.contrib.auth import get_user_model
from django.db import transaction
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

from apps.core.mixins import OrganizationContextMixin
from apps.core.permissions import CanManageUsers, get_role_permissions, role_has_permission

from .models import OrganizationInvitation, OrganizationMembership, OrganizationRole
from .serializers import (
    ChangeRoleSerializer,
    InvitationCreateSerializer,
    InvitationDecisionSerializer,
    InvitationSerializer,
    OrganizationMembershipSerializer,
    OrganizationRoleSerializer,
    SwitchOrganizationSerializer,
    UserCreateSerializer,
    UserRegisterSerializer,
    UserSerializer,
)

User = get_user_model()


def _align_user_context(user: User) -> None:
    membership = user.get_active_membership()
    if membership:
        if user.organization_id != membership.organization_id or user.role != membership.role.code:
            user.sync_context_from_membership(membership, save=True)
        return

    fallback = user.memberships.select_related('organization', 'role').filter(is_active=True).first()
    if fallback:
        user.sync_context_from_membership(fallback, save=True)
        return

    if user.organization_id is not None or user.role != User.Role.USER:
        user.organization = None
        user.role = User.Role.USER
        user.save(update_fields=['organization', 'role'])


class AuthViewSet(viewsets.ViewSet):
    permission_classes = [permissions.AllowAny]

    @action(detail=False, methods=['post'])
    def register(self, request):
        serializer = UserRegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        return Response(UserSerializer(user).data, status=status.HTTP_201_CREATED)


class UserViewSet(OrganizationContextMixin, viewsets.ModelViewSet):
    """User management within active organization + personal org context actions."""

    serializer_class = UserSerializer

    def get_permissions(self):
        if self.action in ['create', 'update', 'partial_update', 'destroy', 'change_role', 'set_active']:
            permission_classes = [permissions.IsAuthenticated, CanManageUsers]
        else:
            permission_classes = [permissions.IsAuthenticated]
        return [permission() for permission in permission_classes]

    def get_queryset(self):
        org = getattr(self.request, 'organization', None)
        if self.request.user.is_authenticated and org:
            return User.objects.filter(memberships__organization=org).distinct()
        return User.objects.none()

    def get_serializer_class(self):
        if self.action == 'create':
            return UserCreateSerializer
        return UserSerializer

    def _membership_in_active_org(self, user: User):
        org = getattr(self.request, 'organization', None)
        if org is None:
            return None
        return OrganizationMembership.objects.select_related('role').filter(
            user=user,
            organization=org,
            is_active=True,
        ).first()

    @transaction.atomic
    def perform_create(self, serializer):
        user = serializer.save()
        role = OrganizationRole.create_default_user(self.request.organization)
        membership, _ = OrganizationMembership.objects.get_or_create(
            user=user,
            organization=self.request.organization,
            defaults={'role': role, 'invited_by': self.request.user, 'is_active': True},
        )
        membership.role = role
        membership.invited_by = self.request.user
        membership.is_active = True
        membership.save(update_fields=['role', 'invited_by', 'is_active', 'updated_at'])
        if user.organization_id is None:
            user.sync_context_from_membership(membership, save=True)

    @action(detail=False, methods=['get', 'put', 'patch'])
    def me(self, request):
        _align_user_context(request.user)
        if request.method == 'GET':
            return Response(UserSerializer(request.user).data)
        serializer = UserSerializer(request.user, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def my_organizations(self, request):
        memberships = request.user.memberships.select_related('organization', 'role').filter(is_active=True)
        serializer = OrganizationMembershipSerializer(memberships, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['post'])
    def switch_organization(self, request):
        serializer = SwitchOrganizationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        org_id = serializer.validated_data['organization_id']
        membership = request.user.memberships.select_related('organization', 'role').filter(
            organization_id=org_id,
            is_active=True,
        ).first()
        if membership is None:
            return Response({'error': 'Организация недоступна для текущего пользователя.'}, status=status.HTTP_404_NOT_FOUND)
        request.user.sync_context_from_membership(membership, save=True)
        request.organization = membership.organization
        return Response(UserSerializer(request.user).data)

    @action(detail=True, methods=['post'])
    def change_role(self, request, pk=None):
        target_user = self.get_object()
        serializer = ChangeRoleSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        role = OrganizationRole.objects.filter(
            id=serializer.validated_data['role_id'],
            organization=request.organization,
        ).first()
        if role is None:
            return Response({'error': 'Роль не найдена.'}, status=status.HTTP_404_NOT_FOUND)

        membership = OrganizationMembership.objects.filter(
            user=target_user,
            organization=request.organization,
            is_active=True,
        ).select_related('role').first()
        if membership is None:
            return Response({'error': 'Пользователь не состоит в текущей организации.'}, status=status.HTTP_404_NOT_FOUND)

        if role.code == User.Role.SUPER_ADMIN:
            return Response({'error': 'Назначение роли "Главный админ" через интерфейс запрещено. Эта роль есть только у создателя организации.'}, status=status.HTTP_400_BAD_REQUEST)

        if membership.role.code == User.Role.SUPER_ADMIN and role.code != User.Role.SUPER_ADMIN:
            return Response({'error': 'Главного админа нельзя разжаловать.'}, status=status.HTTP_400_BAD_REQUEST)

        actor_membership = self._membership_in_active_org(request.user)
        if (
            actor_membership
            and actor_membership.role.code == User.Role.SUPER_ADMIN
            and target_user.id == request.user.id
            and role.code != User.Role.SUPER_ADMIN
        ):
            return Response({'error': 'Главный админ не может разжаловать самого себя.'}, status=status.HTTP_400_BAD_REQUEST)

        membership.role = role
        membership.save(update_fields=['role', 'updated_at'])
        if target_user.organization_id == request.organization.id:
            target_user.role = role.code
            target_user.save(update_fields=['role'])
        return Response(UserSerializer(target_user).data)

    @action(detail=True, methods=['post'])
    def set_active(self, request, pk=None):
        target_user = self.get_object()
        is_active = bool(request.data.get('is_active', True))
        target_membership = self._membership_in_active_org(target_user)
        if target_membership and target_membership.role.code == User.Role.SUPER_ADMIN and not is_active:
            return Response({'error': 'Главного админа нельзя деактивировать.'}, status=status.HTTP_400_BAD_REQUEST)
        actor_membership = self._membership_in_active_org(request.user)
        if (
            actor_membership
            and actor_membership.role.code == User.Role.SUPER_ADMIN
            and target_user.id == request.user.id
            and not is_active
        ):
            return Response({'error': 'Главный админ не может деактивировать себя.'}, status=status.HTTP_400_BAD_REQUEST)
        target_user.is_active = is_active
        target_user.save(update_fields=['is_active'])
        return Response(UserSerializer(target_user).data)

    def destroy(self, request, *args, **kwargs):
        target_user = self.get_object()
        target_membership = self._membership_in_active_org(target_user)
        if target_membership and target_membership.role.code == User.Role.SUPER_ADMIN:
            return Response({'error': 'Главного админа нельзя удалить.'}, status=status.HTTP_400_BAD_REQUEST)
        actor_membership = self._membership_in_active_org(request.user)
        if (
            actor_membership
            and actor_membership.role.code == User.Role.SUPER_ADMIN
            and target_user.id == request.user.id
        ):
            return Response({'error': 'Главный админ не может удалить самого себя.'}, status=status.HTTP_400_BAD_REQUEST)
        return super().destroy(request, *args, **kwargs)

    @action(detail=False, methods=['get'])
    def permissions(self, request):
        _align_user_context(request.user)
        perms = get_role_permissions(request.user)
        return Response({'role': request.user.role, 'permissions': perms})


class OrganizationRoleViewSet(OrganizationContextMixin, viewsets.ModelViewSet):
    serializer_class = OrganizationRoleSerializer
    protected_role_codes = {User.Role.USER, User.Role.SUPER_ADMIN}

    def get_permissions(self):
        if self.action in ['list', 'retrieve']:
            permission_classes = [permissions.IsAuthenticated]
        else:
            permission_classes = [permissions.IsAuthenticated, CanManageUsers]
        return [permission() for permission in permission_classes]

    def get_queryset(self):
        org = getattr(self.request, 'organization', None)
        if org is None:
            return OrganizationRole.objects.none()
        return OrganizationRole.objects.filter(organization=org).order_by('name')

    def perform_create(self, serializer):
        serializer.save(organization=self.request.organization)

    def perform_update(self, serializer):
        role = self.get_object()
        if role.code in self.protected_role_codes:
            raise ValidationError('Роли "Пользователь" и "Главный админ" нельзя редактировать.')
        serializer.save()

    def destroy(self, request, *args, **kwargs):
        role = self.get_object()
        if role.code in self.protected_role_codes:
            return Response({'error': 'Роли "Пользователь" и "Главный админ" нельзя удалять.'}, status=status.HTTP_400_BAD_REQUEST)

        organization = request.organization
        fallback_role = OrganizationRole.create_default_user(organization)

        with transaction.atomic():
            OrganizationMembership.objects.filter(organization=organization, role=role).update(role=fallback_role)
            OrganizationInvitation.objects.filter(organization=organization, role=role).update(role=fallback_role)
            User.objects.filter(organization=organization, role=role.code).update(role=fallback_role.code)

            # Keep approval flows consistent if a referenced custom role is deleted.
            from apps.approvals.models import ApprovalRoute, ApprovalTask

            ApprovalTask.objects.filter(contract__organization=organization, role=role.code).update(role=fallback_role.code)
            for route in ApprovalRoute.objects.filter(organization=organization):
                changed = False
                next_stages = []
                for stage in route.stages or []:
                    current = dict(stage)
                    if current.get('role') == role.code:
                        current['role'] = fallback_role.code
                        changed = True
                    next_stages.append(current)
                if changed:
                    route.stages = next_stages
                    route.save(update_fields=['stages', 'updated_at'])

            role.delete()

        return Response(status=status.HTTP_204_NO_CONTENT)


class InvitationViewSet(OrganizationContextMixin, viewsets.GenericViewSet):
    queryset = OrganizationInvitation.objects.all()
    serializer_class = InvitationSerializer

    def get_permissions(self):
        if self.action in ['create', 'list', 'cancel']:
            permission_classes = [permissions.IsAuthenticated, CanManageUsers]
        else:
            permission_classes = [permissions.IsAuthenticated]
        return [permission() for permission in permission_classes]

    def get_queryset(self):
        if self.action == 'my':
            return OrganizationInvitation.objects.filter(
                email__iexact=self.request.user.email,
                status=OrganizationInvitation.Status.PENDING,
            ).select_related('organization', 'role', 'invited_by')

        org = getattr(self.request, 'organization', None)
        if org is None:
            return OrganizationInvitation.objects.none()
        return OrganizationInvitation.objects.filter(organization=org).select_related('organization', 'role', 'invited_by')

    def list(self, request, *args, **kwargs):
        queryset = self.filter_queryset(self.get_queryset())
        page = self.paginate_queryset(queryset)
        serializer = self.get_serializer(page, many=True)
        return self.get_paginated_response(serializer.data)

    def create(self, request, *args, **kwargs):
        serializer = InvitationCreateSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        invitation = serializer.save()
        return Response(InvitationSerializer(invitation).data, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['get'])
    def my(self, request):
        queryset = self.get_queryset()
        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    @transaction.atomic
    def decide(self, request, pk=None):
        invitation = OrganizationInvitation.objects.select_related('organization', 'role').filter(pk=pk).first()
        if invitation is None:
            return Response({'error': 'Приглашение не найдено.'}, status=status.HTTP_404_NOT_FOUND)
        if invitation.email.lower() != (request.user.email or '').lower():
            return Response({'error': 'Нельзя обработать чужое приглашение.'}, status=status.HTTP_403_FORBIDDEN)
        if invitation.status != OrganizationInvitation.Status.PENDING:
            return Response({'error': 'Приглашение уже обработано.'}, status=status.HTTP_400_BAD_REQUEST)

        serializer = InvitationDecisionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        decision = serializer.validated_data['decision']

        if decision == 'decline':
            invitation.mark(OrganizationInvitation.Status.DECLINED)
            return Response({'status': 'declined'})

        membership, _ = OrganizationMembership.objects.get_or_create(
            user=request.user,
            organization=invitation.organization,
            defaults={'role': invitation.role, 'invited_by': invitation.invited_by, 'is_active': True},
        )
        membership.role = invitation.role
        membership.invited_by = invitation.invited_by
        membership.is_active = True
        membership.save(update_fields=['role', 'invited_by', 'is_active', 'updated_at'])

        invitation.invited_user = request.user
        invitation.mark(OrganizationInvitation.Status.ACCEPTED)

        if request.user.organization_id is None:
            request.user.sync_context_from_membership(membership, save=True)

        return Response({'status': 'accepted'})

    @action(detail=True, methods=['post'])
    def cancel(self, request, pk=None):
        invitation = self.get_queryset().filter(pk=pk).first()
        if invitation is None:
            return Response({'error': 'Приглашение не найдено.'}, status=status.HTTP_404_NOT_FOUND)
        if invitation.status != OrganizationInvitation.Status.PENDING:
            return Response({'error': 'Можно отменить только ожидающее приглашение.'}, status=status.HTTP_400_BAD_REQUEST)
        invitation.mark(OrganizationInvitation.Status.EXPIRED)
        return Response({'status': 'cancelled'})
