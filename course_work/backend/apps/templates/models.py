"""Contract template model."""
from django.db import models


class ContractTemplate(models.Model):
    """Predefined template for contract creation with variable fields."""
    organization = models.ForeignKey(
        'organizations.Organization', on_delete=models.CASCADE,
        related_name='templates', verbose_name='Организация',
    )
    name = models.CharField(max_length=255, verbose_name='Название шаблона')
    description = models.TextField(blank=True, verbose_name='Описание')
    content = models.JSONField(default=dict, verbose_name='Содержимое шаблона (JSON)')
    contract_type = models.CharField(
        max_length=50, default='standard', verbose_name='Тип договора',
    )
    variables = models.JSONField(default=list, blank=True, verbose_name='Переменные шаблона')
    is_active = models.BooleanField(default=True, verbose_name='Активен')
    created_by = models.ForeignKey(
        'accounts.User', on_delete=models.SET_NULL,
        null=True, verbose_name='Создал',
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='Создан')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='Обновлён')

    class Meta:
        verbose_name = 'Шаблон договора'
        verbose_name_plural = 'Шаблоны договоров'
        ordering = ['name']

    def __str__(self) -> str:
        return self.name