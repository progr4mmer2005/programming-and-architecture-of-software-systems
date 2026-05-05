"""Contractor (contractor) model."""
from django.db import models


class Contractor(models.Model):
    """Counterparty organization that the company signs contracts with."""
    organization = models.ForeignKey(
        'organizations.Organization', on_delete=models.CASCADE,
        related_name='contractors', verbose_name='Организация',
    )
    name = models.CharField(max_length=255, verbose_name='Название')
    full_name = models.CharField(max_length=500, blank=True, verbose_name='Полное название')
    inn = models.CharField(max_length=12, verbose_name='ИНН')
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
        unique_together = ['organization', 'inn']

    def __str__(self) -> str:
        return self.name