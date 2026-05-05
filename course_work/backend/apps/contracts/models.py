"""Contract and ContractVersion models."""
from django.db import models


class Contract(models.Model):
    """Main contract entity with lifecycle status tracking."""

    class Status(models.TextChoices):
        DRAFT = 'draft', 'Проект'
        APPROVAL = 'approval', 'На согласовании'
        ACTIVE = 'active', 'Действует'
        EXECUTION = 'execution', 'Исполнение'
        CLOSED = 'closed', 'Закрыт'
        ARCHIVED = 'archived', 'Архив'

    class Type(models.TextChoices):
        STANDARD = 'standard', 'Стандартный'
        SERVICE = 'service', 'Услуги'
        SUPPLY = 'supply', 'Поставка'
        LEASE = 'lease', 'Аренда'
        NDA = 'nda', 'NDA'
        LABOR = 'labor', 'Трудовой'
        OTHER = 'other', 'Прочее'

    organization = models.ForeignKey(
        'organizations.Organization', on_delete=models.CASCADE,
        related_name='contracts', verbose_name='Организация',
    )
    title = models.CharField(max_length=500, verbose_name='Название')
    number = models.CharField(max_length=100, blank=True, verbose_name='Номер договора')
    status = models.CharField(
        max_length=20, choices=Status.choices, default=Status.DRAFT, verbose_name='Статус',
    )
    contract_type = models.CharField(
        max_length=20, choices=Type.choices, default=Type.STANDARD, verbose_name='Тип договора',
    )
    contractor = models.ForeignKey(
        'contractors.Contractor', on_delete=models.SET_NULL,
        null=True, blank=True, related_name='contracts', verbose_name='Контрагент',
    )
    amount = models.DecimalField(max_digits=15, decimal_places=2, default=0, verbose_name='Сумма')
    currency = models.CharField(max_length=3, default='RUB', verbose_name='Валюта')
    start_date = models.DateField(null=True, blank=True, verbose_name='Дата начала')
    end_date = models.DateField(null=True, blank=True, verbose_name='Дата окончания')
    description = models.TextField(blank=True, verbose_name='Описание')
    current_version = models.IntegerField(default=1, verbose_name='Текущая версия')
    template = models.ForeignKey(
        'templates.ContractTemplate', on_delete=models.SET_NULL,
        null=True, blank=True, verbose_name='Шаблон',
    )
    created_by = models.ForeignKey(
        'accounts.User', on_delete=models.SET_NULL,
        null=True, related_name='created_contracts', verbose_name='Создал',
    )
    responsible = models.ForeignKey(
        'accounts.User', on_delete=models.SET_NULL,
        null=True, blank=True, related_name='responsible_contracts', verbose_name='Ответственный',
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='Создан')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='Обновлён')

    class Meta:
        verbose_name = 'Договор'
        verbose_name_plural = 'Договоры'
        ordering = ['-created_at']

    def __str__(self) -> str:
        return f"{self.number or '№___'} - {self.title}"


class ContractVersion(models.Model):
    """Versioned snapshot of contract content."""
    contract = models.ForeignKey(
        Contract, on_delete=models.CASCADE,
        related_name='versions', verbose_name='Договор',
    )
    version_number = models.IntegerField(verbose_name='Номер версии')
    number = models.CharField(max_length=100, blank=True, verbose_name='Номер договора')
    amount = models.DecimalField(max_digits=15, decimal_places=2, default=0, verbose_name='Сумма')
    content = models.JSONField(default=dict, verbose_name='Содержимое')
    file = models.FileField(upload_to='contracts/', blank=True, null=True, verbose_name='Файл')
    changelog = models.TextField(blank=True, verbose_name='Описание изменений')
    created_by = models.ForeignKey(
        'accounts.User', on_delete=models.SET_NULL,
        null=True, verbose_name='Создал',
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='Создана')
    is_current = models.BooleanField(default=False, verbose_name='Текущая версия')

    class Meta:
        verbose_name = 'Версия договора'
        verbose_name_plural = 'Версии договоров'
        ordering = ['-version_number']
        unique_together = ['contract', 'version_number']

    def __str__(self) -> str:
        return f"{self.contract} v{self.version_number}"