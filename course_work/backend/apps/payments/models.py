"""Payment and PaymentCalendar models."""
from django.db import models


class Payment(models.Model):
    """Planned or actual payment for a contract."""

    class Type(models.TextChoices):
        PLANNED = 'planned', 'Плановый'
        ACTUAL = 'actual', 'Фактический'

    class Status(models.TextChoices):
        PENDING = 'pending', 'Ожидается'
        PAID = 'paid', 'Оплачен'
        OVERDUE = 'overdue', 'Просрочен'
        CANCELLED = 'cancelled', 'Отменён'

    contract = models.ForeignKey(
        'contracts.Contract', on_delete=models.CASCADE,
        related_name='payments', verbose_name='Договор',
    )
    estimate = models.ForeignKey(
        'estimates.Estimate', on_delete=models.SET_NULL,
        null=True, blank=True, related_name='payments', verbose_name='Смета',
    )
    type = models.CharField(
        max_length=20, choices=Type.choices, verbose_name='Тип платежа',
    )
    amount = models.DecimalField(max_digits=15, decimal_places=2, verbose_name='Сумма')
    planned_date = models.DateField(null=True, blank=True, verbose_name='Плановая дата')
    actual_date = models.DateField(null=True, blank=True, verbose_name='Фактическая дата')
    status = models.CharField(
        max_length=20, choices=Status.choices, default=Status.PENDING, verbose_name='Статус',
    )
    description = models.TextField(blank=True, verbose_name='Назначение платежа')
    created_by = models.ForeignKey(
        'accounts.User', on_delete=models.SET_NULL, null=True, verbose_name='Создал',
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='Создан')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='Обновлён')

    class Meta:
        verbose_name = 'Платёж'
        verbose_name_plural = 'Платежи'
        ordering = ['-created_at']

    def __str__(self) -> str:
        return f"{self.contract} - {self.amount} ({self.get_status_display()})"


class PaymentCalendar(models.Model):
    """Monthly payment summary for the organization's payment calendar."""
    organization = models.ForeignKey(
        'organizations.Organization', on_delete=models.CASCADE,
        related_name='payment_calendars', verbose_name='Организация',
    )
    month = models.DateField(verbose_name='Месяц')  # First day of month
    total_planned = models.DecimalField(max_digits=15, decimal_places=2, default=0, verbose_name='План')
    total_actual = models.DecimalField(max_digits=15, decimal_places=2, default=0, verbose_name='Факт')
    debt = models.DecimalField(max_digits=15, decimal_places=2, default=0, verbose_name='Задолженность')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='Обновлён')

    class Meta:
        verbose_name = 'Календарь платежей'
        verbose_name_plural = 'Календари платежей'
        ordering = ['-month']
        unique_together = ['organization', 'month']

    def __str__(self) -> str:
        return f"{self.organization} - {self.month.strftime('%Y-%m')}"