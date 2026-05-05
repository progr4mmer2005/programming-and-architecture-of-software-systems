"""Organization model for multi-tenant support."""
from django.db import models


class Organization(models.Model):
    """Represents a company/tenant in the system."""
    name = models.CharField(max_length=255, verbose_name='Название')
    legal_name = models.CharField(max_length=255, blank=True, verbose_name='Юридическое название')
    inn = models.CharField(max_length=12, unique=True, verbose_name='ИНН')
    kpp = models.CharField(max_length=9, blank=True, verbose_name='КПП')
    ogrn = models.CharField(max_length=15, blank=True, verbose_name='ОГРН')
    address = models.TextField(blank=True, verbose_name='Адрес')
    logo = models.ImageField(upload_to='org_logos/', blank=True, verbose_name='Логотип')
    is_active = models.BooleanField(default=True, verbose_name='Активна')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='Создана')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='Обновлена')

    class Meta:
        verbose_name = 'Организация'
        verbose_name_plural = 'Организации'
        ordering = ['name']

    def __str__(self) -> str:
        return self.name