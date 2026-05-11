from django.db import models


DEFAULT_REFERENCE_ENTRIES = {
    'currency': [
        {'code': 'RUB', 'label': 'Российский рубль', 'description': 'Базовая валюта расчётов', 'metadata': {'rate': 1}},
        {'code': 'USD', 'label': 'Доллар США', 'description': 'Валютный расчёт по экспортным и импортным контрактам', 'metadata': {'rate': 92}},
        {'code': 'EUR', 'label': 'Евро', 'description': 'Валютный расчёт по международным обязательствам', 'metadata': {'rate': 101}},
        {'code': 'CNY', 'label': 'Китайский юань', 'description': 'Расчёты по поставкам из КНР', 'metadata': {'rate': 12.8}},
    ],
    'price_type': [
        {'code': 'fixed', 'label': 'Фиксированная стоимость', 'description': 'Стоимость договора заранее определена'},
        {'code': 'estimate_based', 'label': 'По сметам', 'description': 'Стоимость определяется утверждёнными сметами'},
        {'code': 'free', 'label': 'Безвозмездно', 'description': 'Договор не предполагает оплату'},
        {'code': 'not_specified', 'label': 'Стоимость не указана', 'description': 'Стоимость будет определена позже'},
        {'code': 'by_rates', 'label': 'По тарифам/актам/заявкам', 'description': 'Стоимость определяется связанными документами'},
    ],
    'contract_status': [
        {'code': 'draft', 'label': 'Черновик', 'description': 'Договор создан и готовится'},
        {'code': 'on_approval', 'label': 'На согласовании', 'description': 'Договор проходит маршрут согласования'},
        {'code': 'ready_to_sign', 'label': 'Готов к подписанию', 'description': 'Согласование завершено, договор можно подписывать'},
        {'code': 'signed', 'label': 'Подписан', 'description': 'Подписанный экземпляр получен'},
        {'code': 'active', 'label': 'Действует', 'description': 'Договор исполняется'},
        {'code': 'completed', 'label': 'Завершён', 'description': 'Обязательства исполнены'},
        {'code': 'terminated', 'label': 'Расторгнут', 'description': 'Действие договора прекращено'},
    ],
}


class ReferenceEntry(models.Model):
    class Category(models.TextChoices):
        CURRENCY = 'currency', 'Валюты'
        PRICE_TYPE = 'price_type', 'Типы стоимости'
        CONTRACT_STATUS = 'contract_status', 'Статусы договоров'

    organization = models.ForeignKey(
        'organizations.Organization',
        on_delete=models.CASCADE,
        related_name='reference_entries',
        verbose_name='Организация',
    )
    category = models.CharField(max_length=40, choices=Category.choices, verbose_name='Категория')
    code = models.CharField(max_length=60, verbose_name='Код')
    label = models.CharField(max_length=255, verbose_name='Наименование')
    description = models.TextField(blank=True, verbose_name='Описание')
    metadata = models.JSONField(default=dict, blank=True, verbose_name='Дополнительные параметры')
    is_active = models.BooleanField(default=True, verbose_name='Активен')
    sort_order = models.PositiveIntegerField(default=100, verbose_name='Порядок')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='Создан')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='Обновлён')

    class Meta:
        verbose_name = 'Элемент справочника'
        verbose_name_plural = 'Элементы справочников'
        ordering = ['category', 'sort_order', 'label']
        unique_together = ['organization', 'category', 'code']

    def __str__(self) -> str:
        return f'{self.get_category_display()}: {self.label}'


def bootstrap_reference_entries(organization) -> None:
    for category, entries in DEFAULT_REFERENCE_ENTRIES.items():
        for index, entry in enumerate(entries, start=1):
            ReferenceEntry.objects.update_or_create(
                organization=organization,
                category=category,
                code=entry['code'],
                defaults={
                    'label': entry['label'],
                    'description': entry.get('description', ''),
                    'metadata': entry.get('metadata', {}),
                    'is_active': True,
                    'sort_order': index * 10,
                },
            )
