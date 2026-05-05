from django.contrib import admin
from .models import Contractor


@admin.register(Contractor)
class ContractorAdmin(admin.ModelAdmin):
    list_display = ['name', 'inn', 'organization', 'is_active']
    search_fields = ['name', 'inn', 'ogrn']
    list_filter = ['organization', 'is_active']