"""Global contractor directory with organization relationships."""
from django.db import models


class Contractor(models.Model):
    """Global counterparty card that can be linked to many organizations."""

    organization = models.ForeignKey(
        'organizations.Organization',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='created_contractor_cards',
        verbose_name='Организация-инициатор',
    )
    linked_organization = models.ForeignKey(
        'organizations.Organization',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='counterparty_cards',
        verbose_name='Связанная организация',
    )
    name = models.CharField(max_length=255, verbose_name='Название')
    full_name = models.CharField(max_length=500, blank=True, verbose_name='Полное название')
    inn = models.CharField(max_length=12, db_index=True, verbose_name='ИНН')
    kpp = models.CharField(max_length=9, blank=True, verbose_name='КПП')
    ogrn = models.CharField(max_length=15, blank=True, verbose_name='ОГРН')
    address = models.TextField(blank=True, verbose_name='Адрес')
    phone = models.CharField(max_length=20, blank=True, verbose_name='Телефон')
    email = models.EmailField(blank=True, verbose_name='Email')
    contact_person = models.CharField(max_length=255, blank=True, verbose_name='Контактное лицо')
    bank_name = models.CharField(max_length=255, blank=True, verbose_name='Банк')
    bank_bik = models.CharField(max_length=9, blank=True, verbose_name='БИК')
    bank_account = models.CharField(max_length=20, blank=True, verbose_name='Расчётный счёт')
    notes = models.TextField(blank=True, verbose_name='Примечания')
    is_active = models.BooleanField(default=True, verbose_name='Активен')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='Создан')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='Обновлён')

    class Meta:
        verbose_name = 'Контрагент'
        verbose_name_plural = 'Контрагенты'
        ordering = ['name']

    def __str__(self) -> str:
        return self.name


class OrganizationContractor(models.Model):
    """Relationship between an organization and a global contractor card."""

    organization = models.ForeignKey(
        'organizations.Organization',
        on_delete=models.CASCADE,
        related_name='contractor_links',
        verbose_name='Организация',
    )
    contractor = models.ForeignKey(
        Contractor,
        on_delete=models.CASCADE,
        related_name='organization_links',
        verbose_name='Контрагент',
    )
    is_active = models.BooleanField(default=True, verbose_name='Активная связь')
    notes = models.TextField(blank=True, verbose_name='Примечания по работе')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='Создана')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='Обновлена')

    class Meta:
        verbose_name = 'Связь организации с контрагентом'
        verbose_name_plural = 'Связи организаций с контрагентами'
        ordering = ['organization', 'contractor']
        constraints = [
            models.UniqueConstraint(fields=['organization', 'contractor'], name='unique_organization_contractor'),
        ]

    def __str__(self) -> str:
        return f'{self.organization} -> {self.contractor}'
