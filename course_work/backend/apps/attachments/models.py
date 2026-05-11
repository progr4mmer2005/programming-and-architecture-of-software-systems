"""Universal file attachments for business entities."""
from pathlib import Path

from django.db import models


class FileAttachment(models.Model):
    class EntityType(models.TextChoices):
        CONTRACT = 'contract', 'Договор'
        ESTIMATE = 'estimate', 'Смета'
        STAGE = 'stage', 'Этап'
        ACT = 'act', 'Акт'
        PAYMENT = 'payment', 'Платёж'
        TEMPLATE = 'template', 'Шаблон'

    class Category(models.TextChoices):
        DRAFT = 'draft', 'Черновик'
        FINAL = 'final', 'Финальная версия'
        SIGNED = 'signed', 'Подписанный документ'
        SCAN = 'scan', 'Скан-копия'
        APPENDIX = 'appendix', 'Приложение'
        SOURCE = 'source', 'Исходный файл'
        EXPORT = 'export', 'Экспорт'
        INVOICE = 'invoice', 'Счёт'
        ACT = 'act', 'Акт'
        OTHER = 'other', 'Прочее'

    organization = models.ForeignKey(
        'organizations.Organization', on_delete=models.CASCADE,
        related_name='file_attachments', verbose_name='Организация',
    )
    entity_type = models.CharField(max_length=20, choices=EntityType.choices, verbose_name='Тип сущности')
    entity_id = models.PositiveBigIntegerField(verbose_name='ID сущности')
    category = models.CharField(max_length=20, choices=Category.choices, default=Category.OTHER, verbose_name='Категория')
    file = models.FileField(upload_to='attachments/', verbose_name='Файл')
    file_name = models.CharField(max_length=255, blank=True, verbose_name='Имя файла')
    mime_type = models.CharField(max_length=120, blank=True, verbose_name='MIME-тип')
    size = models.PositiveBigIntegerField(default=0, verbose_name='Размер')
    uploaded_by = models.ForeignKey(
        'accounts.User', on_delete=models.SET_NULL,
        null=True, blank=True, related_name='uploaded_files', verbose_name='Загрузил',
    )
    uploaded_at = models.DateTimeField(auto_now_add=True, verbose_name='Загружен')

    class Meta:
        verbose_name = 'Вложение'
        verbose_name_plural = 'Вложения'
        ordering = ['-uploaded_at']
        indexes = [
            models.Index(fields=['organization', 'entity_type', 'entity_id']),
            models.Index(fields=['entity_type', 'entity_id', 'category']),
        ]

    @property
    def file_url(self):
        return self.file.url if self.file else ''

    def save(self, *args, **kwargs):
        if self.file:
            if not self.file_name:
                self.file_name = Path(self.file.name).name
            self.size = getattr(self.file, 'size', 0) or self.size or 0
        super().save(*args, **kwargs)

    def __str__(self):
        return self.file_name or str(self.file)
