"""Estimate models: estimate, items and immutable snapshots."""
from decimal import Decimal

from django.db import models


class Estimate(models.Model):
    class Status(models.TextChoices):
        DRAFT = 'draft', 'Черновик'
        UNDER_REVIEW = 'under_review', 'На проверке'
        APPROVED = 'approved', 'Утверждена'
        REJECTED = 'rejected', 'Отклонена'
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
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.DRAFT, verbose_name='Статус')
    total_amount = models.DecimalField(max_digits=15, decimal_places=2, default=0, verbose_name='Итоговая сумма')
    currency = models.CharField(max_length=3, default='RUB', verbose_name='Валюта')
    current_version = models.IntegerField(default=1, verbose_name='Текущая версия')
    description = models.TextField(blank=True, verbose_name='Описание')
    approved_at = models.DateTimeField(null=True, blank=True, verbose_name='Дата утверждения')
    created_by = models.ForeignKey('accounts.User', on_delete=models.SET_NULL, null=True, blank=True, verbose_name='Создал')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='Создана')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='Обновлена')

    class Meta:
        verbose_name = 'Смета'
        verbose_name_plural = 'Сметы'
        ordering = ['-created_at']

    @property
    def amount(self):
        return self.total_amount

    def recalculate_total(self, save=True):
        total = sum((item.total for item in self.items.all()), Decimal('0'))
        self.total_amount = total
        if save:
            self.save(update_fields=['total_amount', 'updated_at'])
        return total

    def __str__(self):
        return f"{self.number or '№___'} - {self.title}"


class EstimateItem(models.Model):
    estimate = models.ForeignKey(
        Estimate, on_delete=models.CASCADE,
        related_name='items', verbose_name='Смета',
    )
    stage = models.ForeignKey(
        'stages.ContractStage', on_delete=models.SET_NULL,
        null=True, blank=True, related_name='estimate_items', verbose_name='Этап',
    )
    name = models.CharField(max_length=500, verbose_name='Наименование')
    description = models.TextField(blank=True, verbose_name='Описание')
    unit = models.CharField(max_length=50, blank=True, verbose_name='Единица')
    quantity = models.DecimalField(max_digits=15, decimal_places=3, default=1, verbose_name='Количество')
    price = models.DecimalField(max_digits=15, decimal_places=2, default=0, verbose_name='Цена')
    total = models.DecimalField(max_digits=15, decimal_places=2, default=0, verbose_name='Сумма')
    sort_order = models.IntegerField(default=0, verbose_name='Порядок')

    class Meta:
        verbose_name = 'Позиция сметы'
        verbose_name_plural = 'Позиции сметы'
        ordering = ['estimate', 'sort_order', 'id']

    def save(self, *args, **kwargs):
        self.total = (self.quantity or Decimal('0')) * (self.price or Decimal('0'))
        super().save(*args, **kwargs)
        self.estimate.recalculate_total(save=True)

    def delete(self, *args, **kwargs):
        estimate = self.estimate
        result = super().delete(*args, **kwargs)
        estimate.recalculate_total(save=True)
        return result

    def __str__(self):
        return self.name


class EstimateVersion(models.Model):
    estimate = models.ForeignKey(
        Estimate, on_delete=models.CASCADE,
        related_name='versions', verbose_name='Смета',
    )
    version_number = models.IntegerField(verbose_name='Номер версии')
    snapshot = models.JSONField(default=dict, verbose_name='Снимок данных')
    change_reason = models.TextField(blank=True, verbose_name='Причина изменения')
    created_by = models.ForeignKey('accounts.User', on_delete=models.SET_NULL, null=True, blank=True, verbose_name='Создал')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='Создана')
    is_current = models.BooleanField(default=False, verbose_name='Текущая версия')

    class Meta:
        verbose_name = 'Версия сметы'
        verbose_name_plural = 'Версии смет'
        ordering = ['-version_number']
        unique_together = ['estimate', 'version_number']

    def __str__(self):
        return f'{self.estimate} v{self.version_number}'
