from django.contrib import admin

from .models import FileAttachment


@admin.register(FileAttachment)
class FileAttachmentAdmin(admin.ModelAdmin):
    list_display = ['file_name', 'entity_type', 'entity_id', 'category', 'organization', 'uploaded_at']
    list_filter = ['entity_type', 'category', 'uploaded_at']
    search_fields = ['file_name', 'entity_id']
