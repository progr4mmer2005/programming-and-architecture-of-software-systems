from django.contrib import admin

from .models import ContractTemplate


@admin.register(ContractTemplate)
class ContractTemplateAdmin(admin.ModelAdmin):
    list_display = ['name', 'organization', 'is_active', 'created_at']
    list_filter = ['organization', 'is_active']
    search_fields = ['name', 'description']
