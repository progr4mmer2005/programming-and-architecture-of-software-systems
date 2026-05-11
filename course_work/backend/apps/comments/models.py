"""Comment model for contracts and other entities."""
from django.db import models


class Comment(models.Model):
    """Comment attached to any entity (contract, estimate, etc.)."""
    organization = models.ForeignKey(
        'organizations.Organization', on_delete=models.CASCADE,
        related_name='comments', verbose_name='Организация',
    )
    contract = models.ForeignKey(
        'contracts.Contract', on_delete=models.CASCADE,
        related_name='comments', verbose_name='Договор',
    )
    author = models.ForeignKey(
        'accounts.User', on_delete=models.CASCADE,
        related_name='comments', verbose_name='Автор',
    )
    text = models.TextField(verbose_name='Текст комментария')
    is_internal = models.BooleanField(default=False, verbose_name='Внутренний')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='Создан')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='Обновлён')

    class Meta:
        verbose_name = 'Комментарий'
        verbose_name_plural = 'Комментарии'
        ordering = ['-created_at']

    def __str__(self) -> str:
        return f"{self.author} - {self.text[:50]}..."