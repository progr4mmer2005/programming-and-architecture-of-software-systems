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


def _perm_map(default=False):
    return {key: default for key in PERMISSION_KEYS}


def _legacy_permissions(code):
    if code == 'super_admin':
        return _perm_map(True)
    if code == 'owner':
        return _perm_map(True)
    if code == 'director':
        perms = _perm_map(False)
        for key in ['can_view_dashboard', 'can_view_contracts', 'can_launch_approval', 'can_view_contractors', 'can_view_estimates', 'can_view_approvals', 'can_process_approval_tasks', 'can_view_payments', 'can_view_calendar', 'can_view_reports', 'can_view_audit']:
            perms[key] = True
        return perms
    if code == 'manager':
        perms = _perm_map(False)
        for key in ['can_view_dashboard', 'can_view_contracts', 'can_manage_contracts', 'can_launch_approval', 'can_view_contractors', 'can_manage_contractors', 'can_view_templates', 'can_manage_templates', 'can_view_estimates', 'can_manage_estimates', 'can_view_approvals', 'can_manage_approval_routes', 'can_view_payments', 'can_view_calendar', 'can_view_reports', 'can_view_audit']:
            perms[key] = True
        return perms
    if code == 'approver':
        perms = _perm_map(False)
        for key in ['can_view_dashboard', 'can_view_contracts', 'can_view_estimates', 'can_view_approvals', 'can_process_approval_tasks', 'can_view_payments', 'can_manage_payments', 'can_view_calendar', 'can_view_reports', 'can_view_audit']:
            perms[key] = True
        return perms
    return _perm_map(False)


def _role_name(code):
    mapping = {
        'super_admin': 'Главный админ',
        'user': 'Пользователь',
        'owner': 'Администратор',
        'director': 'Руководитель',
        'manager': 'Менеджер',
        'approver': 'Согласующее лицо',
    }
    return mapping.get(code, code)


def forward(apps, schema_editor):
    User = apps.get_model('accounts', 'User')
    Organization = apps.get_model('organizations', 'Organization')
    OrganizationRole = apps.get_model('accounts', 'OrganizationRole')
    OrganizationMembership = apps.get_model('accounts', 'OrganizationMembership')

    for organization in Organization.objects.all().iterator():
        OrganizationRole.objects.get_or_create(
            organization_id=organization.id,
            code='super_admin',
            defaults={
                'name': 'Главный админ',
                'permissions': _perm_map(True),
                'is_system': True,
            },
        )
        OrganizationRole.objects.get_or_create(
            organization_id=organization.id,
            code='user',
            defaults={
                'name': 'Пользователь',
                'permissions': _perm_map(False),
                'is_system': True,
            },
        )

    for user in User.objects.exclude(organization_id__isnull=True).iterator():
        code = (user.role or 'user').strip()
        if code == 'owner':
            code = 'super_admin'

        role, _ = OrganizationRole.objects.get_or_create(
            organization_id=user.organization_id,
            code=code,
            defaults={
                'name': _role_name(code),
                'permissions': _legacy_permissions(code),
                'is_system': code in {'super_admin', 'user'},
            },
        )
        membership, _ = OrganizationMembership.objects.get_or_create(
            organization_id=user.organization_id,
            user_id=user.id,
            defaults={
                'role_id': role.id,
                'is_active': True,
            },
        )
        changed = False
        if membership.role_id != role.id:
            membership.role_id = role.id
            changed = True
        if not membership.is_active:
            membership.is_active = True
            changed = True
        if changed:
            membership.save(update_fields=['role', 'is_active', 'updated_at'])

        if user.role != code:
            user.role = code
            user.save(update_fields=['role'])


def backward(apps, schema_editor):
    # Backward migration keeps created rows because they may be user-managed at this point.
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0003_alter_user_organization_alter_user_role_and_more'),
    ]

    operations = [
        migrations.RunPython(forward, backward),
    ]
