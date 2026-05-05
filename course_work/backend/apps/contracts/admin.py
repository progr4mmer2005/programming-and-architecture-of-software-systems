from django.contrib import admin
from .models import Contract, ContractVersion


class ContractVersionInline(admin.TabularInline):
    model = ContractVersion
    extra = 0
    readonly_fields = ['version_number', 'created_at', 'is_current']
    can_delete = False


@admin.register(Contract)
class ContractAdmin(admin.ModelAdmin):
    list_display = ['title', 'number', 'status', 'contract_type', 'contractor', 'amount', 'organization', 'created_at']
    list_filter = ['status', 'contract_type', 'organization']
    search_fields = ['title', 'number', 'description']
    inlines = [ContractVersionInline]
    readonly_fields = ['current_version', 'created_at', 'updated_at']


@admin.register(ContractVersion)
class ContractVersionAdmin(admin.ModelAdmin):
    list_display = ['contract', 'version_number', 'is_current', 'created_at']
    list_filter = ['is_current']