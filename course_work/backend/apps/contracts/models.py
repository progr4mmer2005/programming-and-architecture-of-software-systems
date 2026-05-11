"""Contract and ContractVersion models."""
from django.db import models


class Contract(models.Model):
    class PriceType(models.TextChoices):
        FIXED = 'fixed', 'Фиксированная стоимость'
        ESTIMATE_BASED = 'estimate_based', 'По сметам'
        FREE = 'free', 'Безвозмездный'
        NOT_SPECIFIED = 'not_specified', 'Стоимость не указана'
        BY_RATES = 'by_rates', 'По тарифам/актам/заявкам'

    class Status(models.TextChoices):
        DRAFT = 'draft', 'Черновик'
        ON_APPROVAL = 'on_approval', 'На согласовании'
        READY_TO_SIGN = 'ready_to_sign', 'Готов к подписанию'
        SIGNED = 'signed', 'Подписан'
        ACTIVE = 'active', 'Действует'
        COMPLETED = 'completed', 'Завершён'
        TERMINATED = 'terminated', 'Расторгнут'

    organization = models.ForeignKey(
        'organizations.Organization', on_delete=models.CASCADE,
        related_name='contracts', verbose_name='Организация',
    )
    number = models.CharField(max_length=100, blank=True, verbose_name='Номер договора')
    title = models.CharField(max_length=500, verbose_name='Название')
    description = models.TextField(blank=True, verbose_name='Описание')
    contractor = models.ForeignKey(
        'contractors.Contractor', on_delete=models.SET_NULL,
        null=True, blank=True, related_name='contracts', verbose_name='Контрагент',
    )
    amount = models.DecimalField(max_digits=15, decimal_places=2, null=True, blank=True, verbose_name='Сумма')
    currency = models.CharField(max_length=3, null=True, blank=True, default='RUB', verbose_name='Валюта')
    price_type = models.CharField(
        max_length=20, choices=PriceType.choices,
        default=PriceType.NOT_SPECIFIED, verbose_name='Тип стоимости',
    )
    status = models.CharField(
        max_length=20, choices=Status.choices, default=Status.DRAFT, verbose_name='Статус',
    )
    start_date = models.DateField(null=True, blank=True, verbose_name='Дата начала')
    end_date = models.DateField(null=True, blank=True, verbose_name='Дата окончания')
    signing_date = models.DateField(null=True, blank=True, verbose_name='Дата подписания')
    termination_date = models.DateField(null=True, blank=True, verbose_name='Дата расторжения')
    payment_terms = models.TextField(blank=True, verbose_name='Условия оплаты')
    current_version = models.IntegerField(default=1, verbose_name='Текущая версия')
    template = models.ForeignKey(
        'templates.ContractTemplate', on_delete=models.SET_NULL,
        null=True, blank=True, verbose_name='Шаблон',
    )
    created_by = models.ForeignKey(
        'accounts.User', on_delete=models.SET_NULL,
        null=True, blank=True, related_name='created_contracts', verbose_name='Создал',
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

    def __str__(self):
        return f"{self.number or '№___'} - {self.title}"


class ContractVersion(models.Model):
    contract = models.ForeignKey(
        Contract, on_delete=models.CASCADE,
        related_name='versions', verbose_name='Договор',
    )
    version_number = models.IntegerField(verbose_name='Номер версии')
    snapshot = models.JSONField(default=dict, verbose_name='Снимок данных')
    change_reason = models.TextField(blank=True, verbose_name='Причина изменения')
    created_by = models.ForeignKey(
        'accounts.User', on_delete=models.SET_NULL,
        null=True, blank=True, verbose_name='Создал',
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='Создана')
    is_current = models.BooleanField(default=False, verbose_name='Текущая версия')

    class Meta:
        verbose_name = 'Версия договора'
        verbose_name_plural = 'Версии договоров'
        ordering = ['-version_number']
        unique_together = ['contract', 'version_number']

    def __str__(self):
        return f'{self.contract} v{self.version_number}'


class ContractAttachment(models.Model):
    class DocumentType(models.TextChoices):
        SCAN = 'scan', 'Скан-копия'
        ADDENDUM = 'appendix', 'Приложение'
        ACT = 'act', 'Акт'
        INVOICE = 'invoice', 'Счёт'
        ESTIMATE = 'source', 'Сметный файл'
        OTHER = 'other', 'Прочий документ'

    contract = models.ForeignKey(
        Contract, on_delete=models.CASCADE,
        related_name='legacy_attachments', verbose_name='Договор',
    )
    title = models.CharField(max_length=255, verbose_name='Название документа')
    document_type = models.CharField(max_length=20, choices=DocumentType.choices, default=DocumentType.OTHER, verbose_name='Тип документа')
    file = models.FileField(upload_to='contract_attachments/', verbose_name='Файл')
    description = models.TextField(blank=True, verbose_name='Описание')
    uploaded_by = models.ForeignKey('accounts.User', on_delete=models.SET_NULL, null=True, blank=True, verbose_name='Загрузил')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='Создан')

    class Meta:
        verbose_name = 'Вложение договора (старое)'
        verbose_name_plural = 'Вложения договоров (старые)'
        ordering = ['-created_at']

    def __str__(self):
        return self.title
