"""Audit log model for tracking all changes."""
from django.db import models


class AuditLog(models.Model):
    """Immutable log entry tracking changes to any model."""
    organization = models.ForeignKey(
        'organizations.Organization', on_delete=models.CASCADE,
        related_name='audit_logs', verbose_name='Организация',
    )
    user = models.ForeignKey(
        'accounts.User', on_delete=models.SET_NULL,
        null=True, blank=True, verbose_name='Пользователь',
    )
    action = models.CharField(max_length=50, verbose_name='Действие')  # create, update, delete, status_change
    entity_type = models.CharField(max_length=100, verbose_name='Тип сущности')
    entity_id = models.IntegerField(verbose_name='ID сущности')
    changes = models.JSONField(default=dict, blank=True, verbose_name='Изменения')
    description = models.TextField(blank=True, verbose_name='Описание')
    ip_address = models.GenericIPAddressField(blank=True, null=True, verbose_name='IP адрес')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='Создана')

    class Meta:
        verbose_name = 'Запись аудита'
        verbose_name_plural = 'Записи аудита'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['entity_type', 'entity_id']),
            models.Index(fields=['organization', '-created_at']),
        ]

    def __str__(self) -> str:
        return f"{self.get_action_display()} - {self.entity_type}#{self.entity_id} - {self.created_at}"