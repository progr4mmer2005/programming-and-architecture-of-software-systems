from django.contrib import admin

from .models import Payment, PaymentCalendar


@admin.register(Payment)
class PaymentAdmin(admin.ModelAdmin):
    list_display = ['contract', 'stage', 'act', 'type', 'amount', 'planned_date', 'paid_date', 'status', 'created_at']
    list_filter = ['type', 'status', 'planned_date', 'paid_date']
    search_fields = ['contract__title', 'contract__number', 'description', 'act__number']


@admin.register(PaymentCalendar)
class PaymentCalendarAdmin(admin.ModelAdmin):
    list_display = ['organization', 'month', 'total_planned', 'total_actual', 'debt', 'updated_at']
    list_filter = ['month']
