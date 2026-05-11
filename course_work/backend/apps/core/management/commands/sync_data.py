"""
Management command to copy data between MySQL and SQLite databases.

Usage:
    python manage.py sync_data mysql2sqlite   # Copy from MySQL → SQLite
    python manage.py sync_data sqlite2mysql   # Copy from SQLite → MySQL

Both databases must be configured side-by-side.
Run with DB_ENGINE=mysql (source) and after switching .env to DB_ENGINE=sqlite (target).
"""
from django.core.management.base import BaseCommand, CommandError
from django.apps import apps
from django.conf import settings
from django.db import connections, DEFAULT_DB_ALIAS
import sys


class Command(BaseCommand):
    help = 'Copy all data between MySQL and SQLite databases'

    def add_arguments(self, parser):
        parser.add_argument(
            'direction',
            type=str,
            choices=['mysql2sqlite', 'sqlite2mysql'],
            help='Copy direction: mysql2sqlite or sqlite2mysql',
        )

    def handle(self, *args, **options):
        direction = options['direction']

        if direction == 'mysql2sqlite':
            source_db = 'default'  # current DB (mysql)
            # We need a second connection alias for sqlite
            target_db = 'target_db'
            # Register SQLite database on-the-fly
            settings.DATABASES[target_db] = {
                'ENGINE': 'django.db.backends.sqlite3',
                'NAME': settings.BASE_DIR / 'db.sqlite3',
            }
        else:  # sqlite2mysql
            source_db = 'default'  # current DB (sqlite)
            target_db = 'target_db'
            settings.DATABASES[target_db] = {
                'ENGINE': 'django.db.backends.mysql',
                'NAME': settings.DATABASES[source_db].get('NAME', 'contracts_db'),
                'USER': settings.DATABASES[source_db].get('USER', 'root'),
                'PASSWORD': settings.DATABASES[source_db].get('PASSWORD', 'root'),
                'HOST': settings.DATABASES[source_db].get('HOST', 'localhost'),
                'PORT': settings.DATABASES[source_db].get('PORT', '3306'),
                'OPTIONS': {
                    'charset': 'utf8mb4',
                    'init_command': "SET sql_mode='STRICT_TRANS_TABLES'",
                },
            }

        self.stdout.write(f"Copying data: {source_db} -> {target_db}")

        # Ensure the target database tables exist (run migrations)
        from django.core.management import call_command
        self.stdout.write("Running migrations on target database...")
        call_command('migrate', database=target_db, run_syncdb=True, interactive=False)

        # Get all models from installed apps (excluding Django's own tables)
        models_to_sync = []
        for app_config in apps.get_app_configs():
            if app_config.name.startswith('django.'):
                continue
            for model in app_config.get_models():
                # Skip many-to-many through models — they'll be handled automatically
                if model._meta.auto_created:
                    continue
                models_to_sync.append(model)

        # Sort models by dependency order to avoid FK issues
        def model_sort_key(m):
            deps = len([f for f in m._meta.get_fields() if f.many_to_one and f.remote_field])
            return deps

        models_to_sync.sort(key=model_sort_key)

        total_copied = 0
        for model in models_to_sync:
            source_qs = model.objects.using(source_db).all()
            count = source_qs.count()
            if count == 0:
                continue

            self.stdout.write(f"  Syncing {model._meta.label} ({count} rows)...", ending=' ')
            self.stdout.flush()

            # Delete existing data in target to avoid duplicates
            model.objects.using(target_db).all().delete()

            # Batch insert
            batch_size = 500
            objs = list(source_qs)
            for i in range(0, len(objs), batch_size):
                batch = objs[i:i + batch_size]
                # Detach from source DB
                for obj in batch:
                    obj._state.db = target_db
                model.objects.using(target_db).bulk_create(batch, ignore_conflicts=True)

            total_copied += count
            self.stdout.write(self.style.SUCCESS('OK'))

        # Clean up temporary database config
        del settings.DATABASES[target_db]

        self.stdout.write(self.style.SUCCESS(f"\nDone! Copied {total_copied} rows total."))