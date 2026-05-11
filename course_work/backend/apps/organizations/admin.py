from django.contrib import admin
from .models import Organization


@admin.register(Organization)
class OrganizationAdmin(admin.ModelAdmin):
    list_display = ['name', 'inn', 'is_active', 'created_at']
    search_fields = ['name', 'inn', 'ogrn']
    list_filter = ['is_active']
    readonly_fields = ['created_at', 'updated_at']