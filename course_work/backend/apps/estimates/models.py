"""Estimate and EstimateVersion models."""
from django.db import models


class Estimate(models.Model):
    """Cost estimate attached to a contract."""

    class Status(models.TextChoices):
        DRAFT = 'draft', 'Проект'
        ACTIVE = 'active', 'Действует'
        APPROVED = 'approved', 'Утверждена'
        ARCHIVED = 'archived', 'Архив'

    organization = models.ForeignKey(
        'organizations.Organization', on_delete=models.CASCADE,
        related_name='estimates', verbose_name='Организация',
    )
    contract = models.ForeignKey(
        'contracts.Contract', on_delete=models.CASCADE,
        related_name='estimates', verbose_name='Договор',
    )
    title = models.CharField(max_length=500, verbose_name='Название')
    number = models.CharField(max_length=100, blank=True, verbose_name='Номер сметы')
    amount = models.DecimalField(max_digits=15, decimal_places=2, verbose_name='Сумма')
    current_version = models.IntegerField(default=1, verbose_name='Текущая версия')
    status = models.CharField(
        max_length=20, choices=Status.choices, default=Status.DRAFT, verbose_name='Статус',
    )
    description = models.TextField(blank=True, verbose_name='Описание')
    created_by = models.ForeignKey(
        'accounts.User', on_delete=models.SET_NULL, null=True, verbose_name='Создал',
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='Создана')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='Обновлена')

    class Meta:
        verbose_name = 'Смета'
        verbose_name_plural = 'Сметы'
        ordering = ['-created_at']

    def __str__(self) -> str:
        return f"{self.number or '№___'} - {self.title}"


class EstimateVersion(models.Model):
    """Versioned snapshot of estimate file/content."""
    estimate = models.ForeignKey(
        Estimate, on_delete=models.CASCADE,
        related_name='versions', verbose_name='Смета',
    )
    version_number = models.IntegerField(verbose_name='Номер версии')
    amount = models.DecimalField(max_digits=15, decimal_places=2, default=0, verbose_name='Сумма')
    file = models.FileField(upload_to='estimates/', blank=True, null=True, verbose_name='Файл')
    content = models.JSONField(default=dict, blank=True, verbose_name='Содержимое')
    changelog = models.TextField(blank=True, verbose_name='Описание изменений')
    created_by = models.ForeignKey(
        'accounts.User', on_delete=models.SET_NULL, null=True, verbose_name='Загрузил',
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='Создана')
    is_current = models.BooleanField(default=False, verbose_name='Текущая версия')

    class Meta:
        verbose_name = 'Версия сметы'
        verbose_name_plural = 'Версии смет'
        ordering = ['-version_number']
        unique_together = ['estimate', 'version_number']

    def __str__(self) -> str:
        return f"{self.estimate} v{self.version_number}"