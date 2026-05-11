from django.contrib import admin

from .models import Estimate, EstimateItem, EstimateVersion


class EstimateItemInline(admin.TabularInline):
    model = EstimateItem
    extra = 0
    readonly_fields = ['total']


class EstimateVersionInline(admin.TabularInline):
    model = EstimateVersion
    extra = 0
    readonly_fields = ['version_number', 'snapshot', 'change_reason', 'created_by', 'created_at', 'is_current']
    can_delete = False


@admin.register(Estimate)
class EstimateAdmin(admin.ModelAdmin):
    list_display = ['title', 'number', 'contract', 'total_amount', 'currency', 'status', 'organization', 'created_at']
    list_filter = ['status', 'currency', 'created_at']
    search_fields = ['title', 'number', 'contract__title', 'contract__number']
    inlines = [EstimateItemInline, EstimateVersionInline]


@admin.register(EstimateItem)
class EstimateItemAdmin(admin.ModelAdmin):
    list_display = ['name', 'estimate', 'stage', 'quantity', 'price', 'total', 'sort_order']
    list_filter = ['stage']
    search_fields = ['name', 'description', 'estimate__title']


@admin.register(EstimateVersion)
class EstimateVersionAdmin(admin.ModelAdmin):
    list_display = ['estimate', 'version_number', 'is_current', 'created_by', 'created_at']
    list_filter = ['is_current', 'created_at']
    search_fields = ['estimate__title', 'estimate__number', 'change_reason']
    readonly_fields = ['estimate', 'version_number', 'snapshot', 'change_reason', 'created_by', 'created_at', 'is_current']
