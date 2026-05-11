from django.contrib import admin

from .models import ContractStage


@admin.register(ContractStage)
class ContractStageAdmin(admin.ModelAdmin):
    list_display = ['name', 'contract', 'status', 'planned_amount', 'actual_amount', 'order', 'start_date', 'end_date']
    list_filter = ['status', 'start_date', 'end_date']
    search_fields = ['name', 'description', 'contract__title', 'contract__number']
