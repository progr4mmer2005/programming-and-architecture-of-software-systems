"""Approval route and task models for contract approval workflow."""
from django.db import models


class ApprovalRoute(models.Model):
    """Predefined approval route template with ordered stages."""

    organization = models.ForeignKey(
        'organizations.Organization', on_delete=models.CASCADE,
        related_name='approval_routes', verbose_name='Организация',
    )
    name = models.CharField(max_length=255, verbose_name='Название маршрута')
    stages = models.JSONField(default=list, verbose_name='Этапы согласования')
    is_active = models.BooleanField(default=True, verbose_name='Активен')
    created_by = models.ForeignKey(
        'accounts.User', on_delete=models.SET_NULL, null=True, verbose_name='Создал',
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='Создан')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='Обновлён')

    class Meta:
        verbose_name = 'Маршрут согласования'
        verbose_name_plural = 'Маршруты согласования'
        ordering = ['name']

    def __str__(self) -> str:
        return self.name


class ApprovalTask(models.Model):
    """Individual approval task within a route stage."""

    class Status(models.TextChoices):
        WAITING = 'waiting', 'Ожидает очереди'
        PENDING = 'pending', 'Ожидает'
        APPROVED = 'approved', 'Согласован'
        REJECTED = 'rejected', 'Отклонён'
        SKIPPED = 'skipped', 'Пропущен'

    contract = models.ForeignKey(
        'contracts.Contract', on_delete=models.CASCADE,
        related_name='approval_tasks', verbose_name='Договор',
    )
    route = models.ForeignKey(
        ApprovalRoute, on_delete=models.SET_NULL,
        null=True, blank=True, related_name='tasks', verbose_name='Маршрут',
    )
    stage_order = models.IntegerField(verbose_name='Порядок этапа')
    role = models.CharField(max_length=80, verbose_name='Роль согласующего')
    assigned_to = models.ForeignKey(
        'accounts.User', on_delete=models.SET_NULL,
        null=True, blank=True, related_name='approval_tasks', verbose_name='Назначен',
    )
    status = models.CharField(
        max_length=20, choices=Status.choices, default=Status.PENDING, verbose_name='Статус',
    )
    comment = models.TextField(blank=True, verbose_name='Комментарий')
    deadline = models.DateField(null=True, blank=True, verbose_name='Срок согласования')
    assigned_at = models.DateTimeField(auto_now_add=True, verbose_name='Назначена')
    completed_at = models.DateTimeField(null=True, blank=True, verbose_name='Завершена')

    class Meta:
        verbose_name = 'Задача согласования'
        verbose_name_plural = 'Задачи согласования'
        ordering = ['contract', 'stage_order']

    def __str__(self) -> str:
        return f"{self.contract} - этап {self.stage_order} ({self.get_status_display()})"
