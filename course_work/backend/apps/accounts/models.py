"""Custom user model and organization-level RBAC entities."""
from __future__ import annotations

from uuid import uuid4

from django.contrib.auth.models import AbstractUser
from django.db import models
from django.utils import timezone
from django.utils.text import slugify


PERMISSION_KEYS = [
    'can_view_dashboard',
    'can_view_contracts',
    'can_manage_contracts',
    'can_launch_approval',
    'can_view_contractors',
    'can_manage_contractors',
    'can_view_templates',
    'can_manage_templates',
    'can_view_estimates',
    'can_manage_estimates',
    'can_view_approvals',
    'can_manage_approval_routes',
    'can_process_approval_tasks',
    'can_view_payments',
    'can_manage_payments',
    'can_view_calendar',
    'can_view_reports',
    'can_view_organization',
    'can_manage_organization',
    'can_manage_users',
    'can_manage_references',
    'can_view_audit',
    'scoped_to_assigned_contracts',
]


def build_permission_map(value: bool = False) -> dict[str, bool]:
    return {key: value for key in PERMISSION_KEYS}


def build_default_user_permissions() -> dict[str, bool]:
    """
    Baseline permissions for role 'user':
    users can enter workspace and see core read-only screens.
    """
    permissions = build_permission_map(False)
    permissions.update({
        'can_view_dashboard': True,
        'can_view_contracts': True,
        'can_view_approvals': True,
        'can_view_payments': True,
        'can_view_calendar': True,
        'can_view_reports': True,
        'can_view_organization': True,
    })
    return permissions


class User(AbstractUser):
    """User profile. Active organization context stays in organization/role fields."""

    class Role(models.TextChoices):
        SUPER_ADMIN = 'super_admin', 'Главный админ'
        USER = 'user', 'Пользователь'
        OWNER = 'owner', 'Администратор'
        DIRECTOR = 'director', 'Руководитель'
        MANAGER = 'manager', 'Менеджер'
        APPROVER = 'approver', 'Согласующее лицо'

    organization = models.ForeignKey(
        'organizations.Organization',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='members',
        verbose_name='Текущая организация',
    )
    role = models.CharField(
        max_length=64,
        default=Role.USER,
        verbose_name='Текущая роль',
    )
    patronymic = models.CharField(max_length=150, blank=True, verbose_name='Отчество')
    phone = models.CharField(max_length=20, blank=True, verbose_name='Телефон')
    position = models.CharField(max_length=255, blank=True, verbose_name='Должность')
    is_email_verified = models.BooleanField(default=False, verbose_name='Email подтверждён')
    avatar = models.ImageField(upload_to='avatars/', blank=True, verbose_name='Аватар')

    class Meta:
        verbose_name = 'Пользователь'
        verbose_name_plural = 'Пользователи'
        ordering = ['-date_joined']

    def __str__(self) -> str:
        role_label = self.role or self.Role.USER
        return f"{self.get_full_name() or self.username} ({role_label})"

    def get_active_membership(self) -> 'OrganizationMembership | None':
        if not self.organization_id:
            return None
        return self.memberships.select_related('role', 'organization').filter(
            organization_id=self.organization_id,
            is_active=True,
        ).first()

    def sync_context_from_membership(self, membership: 'OrganizationMembership', save: bool = True) -> None:
        self.organization = membership.organization
        self.role = membership.role.code
        if save:
            self.save(update_fields=['organization', 'role'])


class OrganizationRole(models.Model):
    """Custom role configured by an organization."""

    organization = models.ForeignKey(
        'organizations.Organization',
        on_delete=models.CASCADE,
        related_name='roles',
        verbose_name='Организация',
    )
    name = models.CharField(max_length=120, verbose_name='Название роли')
    code = models.SlugField(max_length=80, verbose_name='Код роли')
    permissions = models.JSONField(default=build_permission_map, verbose_name='Матрица прав')
    is_system = models.BooleanField(default=False, verbose_name='Системная роль')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='Создана')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='Обновлена')

    class Meta:
        verbose_name = 'Роль организации'
        verbose_name_plural = 'Роли организации'
        ordering = ['name']
        constraints = [
            models.UniqueConstraint(fields=['organization', 'code'], name='unique_org_role_code'),
        ]

    def __str__(self) -> str:
        return f'{self.organization} / {self.name}'

    def normalize_permissions(self) -> dict[str, bool]:
        raw = self.permissions or {}
        normalized = build_permission_map(False)
        for key in PERMISSION_KEYS:
            normalized[key] = bool(raw.get(key, False))
        return normalized

    @classmethod
    def create_default_super_admin(cls, organization) -> 'OrganizationRole':
        role, _ = cls.objects.get_or_create(
            organization=organization,
            code=User.Role.SUPER_ADMIN,
            defaults={
                'name': 'Главный админ',
                'permissions': build_permission_map(True),
                'is_system': True,
            },
        )
        return role

    @classmethod
    def create_default_user(cls, organization) -> 'OrganizationRole':
        role, _ = cls.objects.get_or_create(
            organization=organization,
            code=User.Role.USER,
            defaults={
                'name': 'Пользователь',
                'permissions': build_default_user_permissions(),
                'is_system': True,
            },
        )
        desired_permissions = build_default_user_permissions()
        if role.permissions != desired_permissions or not role.is_system or role.name != 'Пользователь':
            role.permissions = desired_permissions
            role.is_system = True
            role.name = 'Пользователь'
            role.save(update_fields=['permissions', 'is_system', 'name', 'updated_at'])
        return role

    def save(self, *args, **kwargs):
        if not self.code:
            self.code = slugify(self.name or '')
        if self.code:
            self.code = self.code.replace('-', '_')
        self.permissions = self.normalize_permissions()
        super().save(*args, **kwargs)


class OrganizationMembership(models.Model):
    """Membership of a user in a specific organization."""

    user = models.ForeignKey(
        'accounts.User',
        on_delete=models.CASCADE,
        related_name='memberships',
        verbose_name='Пользователь',
    )
    organization = models.ForeignKey(
        'organizations.Organization',
        on_delete=models.CASCADE,
        related_name='memberships',
        verbose_name='Организация',
    )
    role = models.ForeignKey(
        'accounts.OrganizationRole',
        on_delete=models.PROTECT,
        related_name='memberships',
        verbose_name='Роль',
    )
    invited_by = models.ForeignKey(
        'accounts.User',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='created_memberships',
        verbose_name='Кем приглашён',
    )
    is_active = models.BooleanField(default=True, verbose_name='Активно')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='Создано')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='Обновлено')

    class Meta:
        verbose_name = 'Участник организации'
        verbose_name_plural = 'Участники организации'
        ordering = ['organization', 'user']
        constraints = [
            models.UniqueConstraint(fields=['organization', 'user'], name='unique_org_user_membership'),
        ]

    def __str__(self) -> str:
        return f'{self.user} in {self.organization}'

    def save(self, *args, **kwargs):
        if self.role.organization_id != self.organization_id:
            raise ValueError('Role must belong to the same organization as membership.')
        super().save(*args, **kwargs)


class OrganizationInvitation(models.Model):
    """Invitation to join an organization."""

    class Status(models.TextChoices):
        PENDING = 'pending', 'Ожидает ответа'
        ACCEPTED = 'accepted', 'Принято'
        DECLINED = 'declined', 'Отклонено'
        EXPIRED = 'expired', 'Истекло'

    organization = models.ForeignKey(
        'organizations.Organization',
        on_delete=models.CASCADE,
        related_name='invitations',
        verbose_name='Организация',
    )
    email = models.EmailField(verbose_name='Email приглашённого')
    role = models.ForeignKey(
        'accounts.OrganizationRole',
        on_delete=models.PROTECT,
        related_name='invitations',
        verbose_name='Назначаемая роль',
    )
    invited_by = models.ForeignKey(
        'accounts.User',
        on_delete=models.SET_NULL,
        null=True,
        related_name='sent_invitations',
        verbose_name='Пригласил',
    )
    invited_user = models.ForeignKey(
        'accounts.User',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='organization_invitations',
        verbose_name='Пользователь',
    )
    token = models.UUIDField(default=uuid4, unique=True, editable=False, verbose_name='Токен')
    message = models.TextField(blank=True, verbose_name='Комментарий')
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.PENDING, verbose_name='Статус')
    responded_at = models.DateTimeField(null=True, blank=True, verbose_name='Ответ получен')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='Создано')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='Обновлено')

    class Meta:
        verbose_name = 'Приглашение в организацию'
        verbose_name_plural = 'Приглашения в организацию'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['organization', 'status'], name='org_invitation_status_idx'),
            models.Index(fields=['email', 'status'], name='org_inv_email_status_idx'),
        ]

    def __str__(self) -> str:
        return f'{self.email} -> {self.organization} ({self.status})'

    def mark(self, status: str) -> None:
        self.status = status
        self.responded_at = timezone.now()
        self.save(update_fields=['status', 'responded_at', 'updated_at'])
