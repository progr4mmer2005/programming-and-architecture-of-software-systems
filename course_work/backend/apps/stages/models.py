"""Contract stages for execution timeline."""
from django.db import models


class ContractStage(models.Model):
    class Status(models.TextChoices):
        PLANNED = 'planned', 'Запланирован'
        IN_PROGRESS = 'in_progress', 'В работе'
        COMPLETED = 'completed', 'Завершён'
        DELAYED = 'delayed', 'Задержан'
        CANCELLED = 'cancelled', 'Отменён'

    contract = models.ForeignKey(
        'contracts.Contract', on_delete=models.CASCADE,
        related_name='stages', verbose_name='Договор',
    )
    name = models.CharField(max_length=255, verbose_name='Название этапа')
    description = models.TextField(blank=True, verbose_name='Описание')
    order = models.IntegerField(default=1, verbose_name='Порядок')
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PLANNED, verbose_name='Статус')
    planned_amount = models.DecimalField(max_digits=15, decimal_places=2, null=True, blank=True, verbose_name='Плановая сумма')
    actual_amount = models.DecimalField(max_digits=15, decimal_places=2, null=True, blank=True, verbose_name='Фактическая сумма')
    start_date = models.DateField(null=True, blank=True, verbose_name='Дата начала')
    end_date = models.DateField(null=True, blank=True, verbose_name='Дата окончания')
    actual_start_date = models.DateField(null=True, blank=True, verbose_name='Фактическое начало')
    actual_end_date = models.DateField(null=True, blank=True, verbose_name='Фактическое окончание')
    responsible_user = models.ForeignKey(
        'accounts.User', on_delete=models.SET_NULL,
        null=True, blank=True, related_name='responsible_stages', verbose_name='Ответственный',
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='Создан')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='Обновлён')

    class Meta:
        verbose_name = 'Этап договора'
        verbose_name_plural = 'Этапы договоров'
        ordering = ['contract', 'order']

    @property
    def amount(self):
        return self.planned_amount or 0

    @property
    def is_completed(self):
        return self.status == self.Status.COMPLETED

    def __str__(self):
        return f'{self.contract} - {self.name}'
