"""Custom User model with roles and organization binding."""
from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):
    """Custom user with role-based access control and organization membership."""

    class Role(models.TextChoices):
        OWNER = 'owner', 'Владелец'
        DIRECTOR = 'director', 'Руководитель'
        MANAGER = 'manager', 'Менеджер'
        LAWYER = 'lawyer', 'Юрист'
        FINANCE = 'finance', 'Финансист'
        ADMIN = 'admin', 'Администратор'

    organization = models.ForeignKey(
        'organizations.Organization',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='members',
        verbose_name='Организация',
    )
    role = models.CharField(
        max_length=20,
        choices=Role.choices,
        default=Role.MANAGER,
        verbose_name='Роль',
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
        return f"{self.get_full_name() or self.username} ({self.get_role_display()})"