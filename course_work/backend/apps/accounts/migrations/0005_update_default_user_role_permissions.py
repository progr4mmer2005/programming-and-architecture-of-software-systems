from django.db import migrations


PERMISSION_KEYS = [
    'can_view_dashboard',
    'can_view_contracts',
    'can_manage_contracts',
    'can_launch_approval',
    'can_view_contractors',
    'can_manage_contractors',
    'can_view_templates',
    'can_manage_templates',
    'can_view_estimates',
    'can_manage_estimates',
    'can_view_approvals',
    'can_manage_approval_routes',
    'can_process_approval_tasks',
    'can_view_payments',
    'can_manage_payments',
    'can_view_calendar',
    'can_view_reports',
    'can_view_organization',
    'can_manage_organization',
    'can_manage_users',
    'can_manage_references',
    'can_view_audit',
    'scoped_to_assigned_contracts',
]


def _build_default_user_permissions():
    permissions = {key: False for key in PERMISSION_KEYS}
    for key in [
        'can_view_dashboard',
        'can_view_contracts',
        'can_view_approvals',
        'can_view_payments',
        'can_view_calendar',
        'can_view_reports',
        'can_view_organization',
    ]:
        permissions[key] = True
    return permissions


def forward(apps, schema_editor):
    OrganizationRole = apps.get_model('accounts', 'OrganizationRole')
    User = apps.get_model('accounts', 'User')

    desired = _build_default_user_permissions()
    for role in OrganizationRole.objects.filter(code='user').iterator():
        role.permissions = desired
        role.is_system = True
        role.name = 'Пользователь'
        role.save(update_fields=['permissions', 'is_system', 'name', 'updated_at'])

    # Align active context role string for users currently in user role contexts.
    for user in User.objects.filter(role__isnull=False).iterator():
        if user.role == 'user':
            user.save(update_fields=['role'])


def backward(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0004_backfill_memberships'),
    ]

    operations = [
        migrations.RunPython(forward, backward),
    ]
