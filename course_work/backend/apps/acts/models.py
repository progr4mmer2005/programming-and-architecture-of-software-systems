"""Acts of completed works or rendered services."""
from django.db import models


class Act(models.Model):
    class Status(models.TextChoices):
        DRAFT = 'draft', 'Черновик'
        SIGNED = 'signed', 'Подписан'
        REJECTED = 'rejected', 'Отклонён'
        CANCELLED = 'cancelled', 'Отменён'

    contract = models.ForeignKey(
        'contracts.Contract', on_delete=models.CASCADE,
        related_name='acts', verbose_name='Договор',
    )
    stage = models.ForeignKey(
        'stages.ContractStage', on_delete=models.SET_NULL,
        null=True, blank=True, related_name='acts', verbose_name='Этап',
    )
    number = models.CharField(max_length=100, verbose_name='Номер акта')
    title = models.CharField(max_length=500, verbose_name='Название')
    date = models.DateField(verbose_name='Дата акта')
    amount = models.DecimalField(max_digits=15, decimal_places=2, default=0, verbose_name='Сумма')
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.DRAFT, verbose_name='Статус')
    description = models.TextField(blank=True, verbose_name='Описание')
    created_by = models.ForeignKey(
        'accounts.User', on_delete=models.SET_NULL,
        null=True, blank=True, related_name='created_acts', verbose_name='Создал',
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='Создан')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='Обновлён')

    class Meta:
        verbose_name = 'Акт'
        verbose_name_plural = 'Акты'
        ordering = ['-date', '-created_at']
        indexes = [models.Index(fields=['contract', 'stage', 'status'])]

    def __str__(self):
        return f'{self.number} - {self.title}'
