from django.contrib import admin

from .models import Contract, ContractAttachment, ContractVersion


class ContractVersionInline(admin.TabularInline):
    model = ContractVersion
    extra = 0
    readonly_fields = ['version_number', 'snapshot', 'change_reason', 'created_by', 'created_at', 'is_current']
    can_delete = False


@admin.register(Contract)
class ContractAdmin(admin.ModelAdmin):
    list_display = ['title', 'number', 'status', 'price_type', 'contractor', 'amount', 'currency', 'organization', 'created_at']
    list_filter = ['status', 'price_type', 'currency', 'created_at']
    search_fields = ['title', 'number', 'contractor__name', 'description']
    inlines = [ContractVersionInline]


@admin.register(ContractVersion)
class ContractVersionAdmin(admin.ModelAdmin):
    list_display = ['contract', 'version_number', 'is_current', 'created_by', 'created_at']
    list_filter = ['is_current', 'created_at']
    search_fields = ['contract__title', 'contract__number', 'change_reason']
    readonly_fields = ['contract', 'version_number', 'snapshot', 'change_reason', 'created_by', 'created_at', 'is_current']


@admin.register(ContractAttachment)
class ContractAttachmentAdmin(admin.ModelAdmin):
    list_display = ['title', 'contract', 'document_type', 'uploaded_by', 'created_at']
    list_filter = ['document_type', 'created_at']
    search_fields = ['title', 'contract__title']
