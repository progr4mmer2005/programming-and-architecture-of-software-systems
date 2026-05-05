from django.contrib import admin
from .models import ApprovalRoute, ApprovalTask


@admin.register(ApprovalRoute)
class ApprovalRouteAdmin(admin.ModelAdmin):
    list_display = ['name', 'organization', 'is_active', 'created_at']
    list_filter = ['organization', 'is_active']
    search_fields = ['name']


@admin.register(ApprovalTask)
class ApprovalTaskAdmin(admin.ModelAdmin):
    list_display = ['contract', 'stage_order', 'role', 'assigned_to', 'status', 'assigned_at']
    list_filter = ['status', 'role']
    search_fields = ['contract__title']