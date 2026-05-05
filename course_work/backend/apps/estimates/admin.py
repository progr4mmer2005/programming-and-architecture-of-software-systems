from django.contrib import admin
from .models import Estimate, EstimateVersion


class EstimateVersionInline(admin.TabularInline):
    model = EstimateVersion
    extra = 0
    readonly_fields = ['version_number', 'created_at', 'is_current']
    can_delete = False


@admin.register(Estimate)
class EstimateAdmin(admin.ModelAdmin):
    list_display = ['title', 'number', 'contract', 'amount', 'status', 'organization', 'created_at']
    list_filter = ['status', 'organization']
    search_fields = ['title', 'number']
    inlines = [EstimateVersionInline]
    readonly_fields = ['current_version', 'created_at', 'updated_at']


@admin.register(EstimateVersion)
class EstimateVersionAdmin(admin.ModelAdmin):
    list_display = ['estimate', 'version_number', 'is_current', 'created_at']
    list_filter = ['is_current']