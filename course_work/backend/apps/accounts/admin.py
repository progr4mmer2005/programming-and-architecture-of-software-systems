from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin

from .models import OrganizationInvitation, OrganizationMembership, OrganizationRole, User


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    list_display = ['username', 'email', 'organization', 'role', 'is_active']
    list_filter = ['organization', 'is_active']
    search_fields = ['username', 'email', 'first_name', 'last_name', 'phone']
    fieldsets = BaseUserAdmin.fieldsets + (
        ('Дополнительно', {'fields': ('organization', 'role', 'patronymic', 'phone', 'position', 'avatar')}),
    )


@admin.register(OrganizationRole)
class OrganizationRoleAdmin(admin.ModelAdmin):
    list_display = ['name', 'code', 'organization', 'is_system', 'updated_at']
    list_filter = ['organization', 'is_system']
    search_fields = ['name', 'code']


@admin.register(OrganizationMembership)
class OrganizationMembershipAdmin(admin.ModelAdmin):
    list_display = ['user', 'organization', 'role', 'is_active', 'updated_at']
    list_filter = ['organization', 'role', 'is_active']
    search_fields = ['user__username', 'user__email', 'organization__name', 'role__name']


@admin.register(OrganizationInvitation)
class OrganizationInvitationAdmin(admin.ModelAdmin):
    list_display = ['email', 'organization', 'role', 'status', 'invited_by', 'created_at']
    list_filter = ['organization', 'status', 'role']
    search_fields = ['email', 'organization__name']
