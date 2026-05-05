from django.contrib import admin
from .models import ContractStage


@admin.register(ContractStage)
class ContractStageAdmin(admin.ModelAdmin):
    list_display = ['name', 'contract', 'amount', 'is_completed', 'order']
    list_filter = ['is_completed']
    search_fields = ['name', 'contract__title']