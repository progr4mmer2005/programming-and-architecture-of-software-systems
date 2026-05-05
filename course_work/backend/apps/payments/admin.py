from django.contrib import admin
from .models import Payment, PaymentCalendar


@admin.register(Payment)
class PaymentAdmin(admin.ModelAdmin):
    list_display = ['contract', 'type', 'amount', 'planned_date', 'status', 'created_at']
    list_filter = ['type', 'status']
    search_fields = ['contract__title', 'description']


@admin.register(PaymentCalendar)
class PaymentCalendarAdmin(admin.ModelAdmin):
    list_display = ['organization', 'month', 'total_planned', 'total_actual', 'debt']
    list_filter = ['organization']