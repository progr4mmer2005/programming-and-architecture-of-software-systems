from django.contrib import admin

from .models import Act


@admin.register(Act)
class ActAdmin(admin.ModelAdmin):
    list_display = ['number', 'title', 'contract', 'stage', 'amount', 'status', 'date']
    list_filter = ['status', 'date']
    search_fields = ['number', 'title', 'contract__title', 'contract__number']
