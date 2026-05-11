"""Application config for acts."""
from django.apps import AppConfig


class ActsConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.acts'
    verbose_name = 'Акты'
