"""Contract stages/milestones model."""
from django.db import models


class ContractStage(models.Model):
    """A stage or milestone within a contract's lifecycle."""
    contract = models.ForeignKey(
        'contracts.Contract', on_delete=models.CASCADE,
        related_name='stages', verbose_name='Договор',
    )
    name = models.CharField(max_length=255, verbose_name='Название этапа')
    description = models.TextField(blank=True, verbose_name='Описание')
    amount = models.DecimalField(max_digits=15, decimal_places=2, default=0, verbose_name='Сумма этапа')
    start_date = models.DateField(null=True, blank=True, verbose_name='Дата начала')
    end_date = models.DateField(null=True, blank=True, verbose_name='Дата окончания')
    is_completed = models.BooleanField(default=False, verbose_name='Завершён')
    completed_at = models.DateTimeField(null=True, blank=True, verbose_name='Дата завершения')
    order = models.IntegerField(default=0, verbose_name='Порядок')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='Создан')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='Обновлён')

    class Meta:
        verbose_name = 'Этап договора'
        verbose_name_plural = 'Этапы договоров'
        ordering = ['contract', 'order']

    def __str__(self) -> str:
        return f"{self.contract} - {self.name}"